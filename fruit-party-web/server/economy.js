export class BusinessError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function requirePositiveInteger(value, code, message) {
  if (!Number.isInteger(value) || value < 1) throw new BusinessError(422, code, message)
}

export async function purchaseItem(database, { userId, itemId, quantity, requestId }) {
  requirePositiveInteger(userId, 'INVALID_USER', '无效玩家')
  requirePositiveInteger(itemId, 'INVALID_ITEM', '无效商品')
  requirePositiveInteger(quantity, 'INVALID_QUANTITY', '购买数量必须为正整数')
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 64) {
    throw new BusinessError(422, 'INVALID_REQUEST_ID', '无效购买请求')
  }

  return database.transaction(async (transaction) => {
    const [user] = await transaction.query('SELECT coins, is_tester AS isTester, tester_mode_enabled AS testerModeEnabled FROM users WHERE id = ? FOR UPDATE', [userId])
    if (!user) throw new BusinessError(404, 'PLAYER_NOT_FOUND', '玩家不存在')

    const [item] = await transaction.query(`
      SELECT id, price_coins AS priceCoins, max_purchase_quantity AS maxPurchaseQuantity, enabled
      FROM item_catalog WHERE id = ? FOR UPDATE
    `, [itemId])
    if (!item || !item.enabled) throw new BusinessError(404, 'ITEM_NOT_AVAILABLE', '商品当前不可购买')
    if (quantity > item.maxPurchaseQuantity) throw new BusinessError(422, 'QUANTITY_LIMIT_EXCEEDED', '购买数量超过商品上限')

    const [existing] = await transaction.query(`
      SELECT item_id AS itemId, quantity, charged_coins AS chargedCoins, remaining_coins AS remainingCoins
      FROM shop_purchase_receipts WHERE user_id = ? AND request_id = ? FOR UPDATE
    `, [userId, requestId])
    if (existing) {
      if (existing.itemId !== itemId || existing.quantity !== quantity) {
        throw new BusinessError(409, 'REQUEST_ID_CONFLICT', '购买请求已用于其他商品或数量')
      }
      return {
        chargedCoins: existing.chargedCoins,
        quantity: existing.quantity,
        remainingCoins: existing.remainingCoins,
        replayed: true,
      }
    }

    const [privilege] = await transaction.query('SELECT infinite_coins AS infiniteCoins FROM player_privileges WHERE user_id = ? FOR UPDATE', [userId])
    const testerModeEnabled = Boolean(user.isTester && user.testerModeEnabled)
    const chargedCoins = testerModeEnabled || privilege?.infiniteCoins ? 0 : item.priceCoins * quantity
    if (chargedCoins > user.coins) throw new BusinessError(409, 'INSUFFICIENT_COINS', '金币不足')
    const remainingCoins = user.coins - chargedCoins

    await transaction.execute('UPDATE users SET coins = ? WHERE id = ?', [remainingCoins, userId])
    await transaction.execute(`
      INSERT INTO player_inventory (user_id, item_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
    `, [userId, itemId, quantity])
    await transaction.execute(`
      INSERT INTO shop_purchase_receipts (user_id, request_id, item_id, quantity, charged_coins, remaining_coins)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, requestId, itemId, quantity, chargedCoins, remainingCoins])
    if (chargedCoins > 0) {
      await transaction.execute(`
        INSERT INTO wallet_ledger (user_id, transaction_type, reference_type, reference_id, coins_delta, balance_after)
        VALUES (?, 'purchase', 'shop_purchase', ?, ?, ?)
      `, [userId, requestId, -chargedCoins, remainingCoins])
    }
    return { chargedCoins, quantity, remainingCoins, replayed: false }
  })
}
