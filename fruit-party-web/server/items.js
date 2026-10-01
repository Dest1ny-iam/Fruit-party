import { BusinessError } from './economy.js'

const ENERGY_RECOVERY_INTERVAL_MS = 10 * 60 * 1000
const GAME_ITEM_KEYS = new Set(['revive-card', 'bomb-shield', 'time-plus', 'score-boost'])

function requirePositiveInteger(value, code, message) {
  if (!Number.isInteger(value) || value < 1) throw new BusinessError(422, code, message)
}

function recoverEnergy(user, now) {
  const maxEnergy = Number(user.maxEnergy)
  let energy = Number(user.energy)
  const startedAt = user.energyRecoveryStartedAt ? new Date(user.energyRecoveryStartedAt) : null
  if (energy >= maxEnergy || !startedAt || Number.isNaN(startedAt.valueOf())) return { energy, recoveryStartedAt: null }
  const recovered = Math.floor((now.valueOf() - startedAt.valueOf()) / ENERGY_RECOVERY_INTERVAL_MS)
  if (recovered <= 0) return { energy, recoveryStartedAt: startedAt }
  energy = Math.min(maxEnergy, energy + recovered)
  return {
    energy,
    recoveryStartedAt: energy >= maxEnergy ? null : new Date(startedAt.valueOf() + recovered * ENERGY_RECOVERY_INTERVAL_MS),
  }
}

export async function readInventoryRow(transaction, userId, itemKey) {
  const [row] = await transaction.query(`
    SELECT i.user_id AS userId, i.quantity, c.id AS itemId, c.item_key AS itemKey,
           c.display_name AS displayName
    FROM player_inventory i JOIN item_catalog c ON c.id = i.item_id
    WHERE i.user_id = ? AND c.item_key = ?
    FOR UPDATE
  `, [userId, itemKey])
  if (!row || Number(row.quantity) < 1) throw new BusinessError(409, 'ITEM_NOT_OWNED', '道具库存不足')
  return row
}

export async function consumeInventory(transaction, userId, itemId, quantity = 1) {
  await transaction.execute(
    'UPDATE player_inventory SET quantity = quantity - ? WHERE user_id = ? AND item_id = ? AND quantity >= ?',
    [quantity, userId, itemId, quantity],
  )
}

export async function useInventoryItem(database, { userId, itemKey, now = new Date() }) {
  requirePositiveInteger(userId, 'INVALID_USER', '无效玩家')
  if (typeof itemKey !== 'string' || !itemKey.trim()) throw new BusinessError(422, 'INVALID_ITEM', '无效道具')
  const normalizedKey = itemKey.trim()
  return database.transaction(async (transaction) => {
    const [user] = await transaction.query(`
      SELECT id, energy, max_energy AS maxEnergy, energy_recovery_started_at AS energyRecoveryStartedAt
      FROM users WHERE id = ? AND is_disabled = 0 FOR UPDATE
    `, [userId])
    if (!user) throw new BusinessError(404, 'PLAYER_NOT_FOUND', '玩家不存在或已被禁用')
    const inventory = await readInventoryRow(transaction, userId, normalizedKey)

    if (normalizedKey === 'energy-pack') {
      const recovered = recoverEnergy(user, new Date(now))
      if (recovered.energy >= Number(user.maxEnergy)) throw new BusinessError(409, 'ENERGY_FULL', '当前能量已满，不能使用能量卡')
      const energy = Math.min(Number(user.maxEnergy), recovered.energy + 1)
      const recoveryStartedAt = energy >= Number(user.maxEnergy)
        ? null
        : (recovered.recoveryStartedAt || new Date(now))
      await transaction.execute('UPDATE users SET energy = ?, energy_recovery_started_at = ? WHERE id = ?', [energy, recoveryStartedAt, userId])
      await consumeInventory(transaction, userId, inventory.itemId)
      return { itemKey: normalizedKey, quantity: 1, energy, maxEnergy: Number(user.maxEnergy), energyRecoveryStartedAt: recoveryStartedAt?.toISOString?.() ?? null }
    }

    if (!GAME_ITEM_KEYS.has(normalizedKey) && normalizedKey !== 'coin-boost') {
      throw new BusinessError(422, 'UNSUPPORTED_ITEM', '该道具暂不支持直接使用')
    }
    await consumeInventory(transaction, userId, inventory.itemId)
    if (normalizedKey === 'coin-boost') {
      await transaction.execute(`
        INSERT INTO player_effects (user_id, effect_key, expires_at, uses_left)
        VALUES (?, 'coin-boost', DATE_ADD(?, INTERVAL 30 MINUTE), 0)
        ON DUPLICATE KEY UPDATE expires_at = GREATEST(COALESCE(expires_at, ?), DATE_ADD(?, INTERVAL 30 MINUTE))
      `, [userId, now, now, now])
      return { itemKey: normalizedKey, quantity: 1, expiresAt: new Date(new Date(now).valueOf() + 30 * 60 * 1000).toISOString() }
    }
    return { itemKey: normalizedKey, quantity: 1 }
  })
}

export async function consumeGameItems(database, { userId, mode, itemKeys = [] }) {
  requirePositiveInteger(userId, 'INVALID_USER', '无效玩家')
  if (!['normal', 'hard', 'endless'].includes(mode)) throw new BusinessError(422, 'INVALID_MODE', '无效游戏模式')
  if (!Array.isArray(itemKeys) || itemKeys.some((key) => typeof key !== 'string')) throw new BusinessError(422, 'INVALID_ITEMS', '道具选择格式无效')
  const uniqueKeys = [...new Set(itemKeys.map((key) => key.trim()).filter(Boolean))]
  if (uniqueKeys.some((key) => !GAME_ITEM_KEYS.has(key))) throw new BusinessError(422, 'INVALID_ITEMS', '该道具不能在进入游戏时使用')
  if (uniqueKeys.includes('time-plus') && mode === 'endless') throw new BusinessError(422, 'ITEM_NOT_ALLOWED', '无尽模式不能使用延时卡')
  return database.transaction((transaction) => consumeGameItemsInTransaction(transaction, { userId, mode, itemKeys: uniqueKeys }))
}

export async function consumeGameItemsInTransaction(transaction, { userId, mode, itemKeys = [] }) {
  const uniqueKeys = [...new Set(itemKeys.map((key) => key.trim()).filter(Boolean))]
  if (uniqueKeys.some((key) => !GAME_ITEM_KEYS.has(key))) throw new BusinessError(422, 'INVALID_ITEMS', '该道具不能在进入游戏时使用')
  if (uniqueKeys.includes('time-plus') && mode === 'endless') throw new BusinessError(422, 'ITEM_NOT_ALLOWED', '无尽模式不能使用延时卡')
  for (const itemKey of uniqueKeys) {
    // 复活卡绑定到本局，但只在服务端确认每次复活时扣除，避免进入后直接退出也消耗库存。
    if (itemKey === 'revive-card') continue
    const inventory = await readInventoryRow(transaction, userId, itemKey)
    await consumeInventory(transaction, userId, inventory.itemId)
  }
  return { activeItems: uniqueKeys }
}
