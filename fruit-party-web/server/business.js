import { randomUUID } from 'node:crypto'
import { BusinessError } from './economy.js'
import { consumeGameItemsInTransaction, consumeInventory, readInventoryRow } from './items.js'

function requirePositiveInteger(value, code, message) {
  if (!Number.isInteger(value) || value < 1) throw new BusinessError(422, code, message)
}

function booleanPrivileges(privileges = {}) {
  return {
    infiniteEnergy: privileges.infiniteEnergy === true,
    infiniteCoins: privileges.infiniteCoins === true,
    unlockAllLevels: privileges.unlockAllLevels === true,
  }
}

function uniqueRecipientIds(recipientIds) {
  if (!Array.isArray(recipientIds)) throw new BusinessError(422, 'INVALID_RECIPIENTS', '接收玩家格式无效')
  const ids = [...new Set(recipientIds)]
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) throw new BusinessError(422, 'INVALID_RECIPIENTS', '接收玩家格式无效')
  return ids
}

const ENERGY_RECOVERY_INTERVAL_MS = 10 * 60 * 1000

function settledNow(now) {
  const current = new Date(now)
  current.setMilliseconds(0)
  return current
}

function recoverEnergy(player, now) {
  let energy = Number(player.energy)
  const maxEnergy = Number(player.maxEnergy)
  const startedAt = player.energyRecoveryStartedAt ? new Date(player.energyRecoveryStartedAt) : null
  if (energy >= maxEnergy || !startedAt || Number.isNaN(startedAt.valueOf())) return { energy, recoveryStartedAt: null }
  const recovered = Math.floor((now.valueOf() - startedAt.valueOf()) / ENERGY_RECOVERY_INTERVAL_MS)
  if (recovered <= 0) return { energy, recoveryStartedAt: startedAt }
  energy = Math.min(maxEnergy, energy + recovered)
  return {
    energy,
    recoveryStartedAt: energy === maxEnergy ? null : new Date(startedAt.valueOf() + recovered * ENERGY_RECOVERY_INTERVAL_MS),
  }
}

export async function enterGame(database, { userId, mode, levelNumber, itemKeys = [], now = new Date() }) {
  requirePositiveInteger(userId, 'INVALID_PLAYER', '无效玩家')
  if (!['normal', 'hard', 'endless'].includes(mode)) throw new BusinessError(422, 'INVALID_MODE', '无效的游戏模式')
  if (mode !== 'endless' && (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > 10)) throw new BusinessError(422, 'INVALID_LEVEL', '无效的关卡')
  const currentTime = settledNow(now)

  return database.transaction(async (transaction) => {
    const [player] = await transaction.query(`
      SELECT energy, max_energy AS maxEnergy, energy_recovery_started_at AS energyRecoveryStartedAt,
             is_tester AS isTester, tester_mode_enabled AS testerModeEnabled
      FROM users WHERE id = ? FOR UPDATE
    `, [userId])
    if (!player) throw new BusinessError(404, 'PLAYER_NOT_FOUND', '玩家不存在')
    const [privilege] = await transaction.query('SELECT infinite_energy AS infiniteEnergy, unlock_all_levels AS unlockAllLevels FROM player_privileges WHERE user_id = ? FOR UPDATE', [userId])
    const testerModeEnabled = Boolean(player.isTester && player.testerModeEnabled)
    const hasFreeEntry = testerModeEnabled || Boolean(privilege?.infiniteEnergy)
    const unlockAllLevels = testerModeEnabled || Boolean(privilege?.unlockAllLevels)

    if (mode !== 'endless') {
      const [progress] = await transaction.query('SELECT unlocked FROM level_progress WHERE user_id = ? AND mode = ? AND level_number = ? FOR UPDATE', [userId, mode, levelNumber])
      if (!progress || (!progress.unlocked && !unlockAllLevels)) throw new BusinessError(403, 'LEVEL_LOCKED', '该关卡尚未解锁')
    }

    const recovered = recoverEnergy(player, currentTime)
    if (!hasFreeEntry && recovered.energy < 1) throw new BusinessError(409, 'INSUFFICIENT_ENERGY', '能量不足，暂时无法开始游戏')
    const nextEnergy = hasFreeEntry ? recovered.energy : recovered.energy - 1
    const nextRecoveryStartedAt = nextEnergy < Number(player.maxEnergy)
      ? (recovered.recoveryStartedAt || currentTime)
      : null
    if (!hasFreeEntry || recovered.energy !== Number(player.energy)) {
      await transaction.execute('UPDATE users SET energy = ?, energy_recovery_started_at = ? WHERE id = ?', [nextEnergy, nextRecoveryStartedAt, userId])
    }
    const itemResult = await consumeGameItemsInTransaction(transaction, { userId, mode, itemKeys })
    const sessionId = randomUUID()
    await transaction.execute('INSERT INTO game_sessions (id, user_id, mode, level_number) VALUES (?, ?, ?, ?)', [sessionId, userId, mode, mode === 'endless' ? null : levelNumber])
    for (const itemKey of itemResult.activeItems) {
      await transaction.execute(`
        INSERT INTO game_session_items (session_id, user_id, item_key, allowed_uses)
        VALUES (?, ?, ?, 1)
      `, [sessionId, userId, itemKey])
    }
    return {
      sessionId,
      chargedEnergy: hasFreeEntry ? 0 : 1,
      energy: nextEnergy,
      maxEnergy: Number(player.maxEnergy),
      energyRecoveryStartedAt: nextRecoveryStartedAt?.toISOString() ?? null,
      activeItems: itemResult.activeItems,
    }
  })
}

function requireSessionId(sessionId) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw new BusinessError(422, 'SESSION_REQUIRED', '缺少有效的游戏场次')
  return sessionId.trim()
}

async function lockGameSession(transaction, { userId, sessionId }) {
  const normalizedSessionId = requireSessionId(sessionId)
  const [session] = await transaction.query(`
    SELECT id, user_id AS userId, mode, level_number AS levelNumber, status
    FROM game_sessions WHERE id = ? FOR UPDATE
  `, [normalizedSessionId])
  if (!session) throw new BusinessError(404, 'GAME_SESSION_NOT_FOUND', '游戏场次不存在')
  if (Number(session.userId) !== Number(userId)) throw new BusinessError(403, 'GAME_SESSION_FORBIDDEN', '无权操作该游戏场次')
  if (session.status !== 'active') throw new BusinessError(409, 'GAME_SESSION_CLOSED', '游戏场次已关闭')
  return session
}

export async function activateGameSessionItem(database, { userId, sessionId, itemKey, now = new Date() }) {
  requirePositiveInteger(userId, 'INVALID_USER', '无效玩家')
  if (!['bomb-shield', 'score-boost'].includes(itemKey)) throw new BusinessError(422, 'INVALID_ITEM', '该道具不能主动使用')
  const currentTime = new Date(now)
  return database.transaction(async (transaction) => {
    const session = await lockGameSession(transaction, { userId, sessionId })
    if (session.mode !== 'endless') throw new BusinessError(422, 'ITEM_NOT_ALLOWED', '主动道具只适用于无尽模式')
    const [item] = await transaction.query(`
      SELECT item_key AS itemKey, allowed_uses AS allowedUses, used_count AS usedCount, active_until AS activeUntil
      FROM game_session_items WHERE session_id = ? AND item_key = ? FOR UPDATE
    `, [session.id, itemKey])
    if (!item) throw new BusinessError(409, 'ITEM_NOT_CARRIED', '本局没有携带该道具')
    if (Number(item.usedCount) >= Number(item.allowedUses)) throw new BusinessError(409, 'ITEM_ALREADY_USED', '该道具本局已经使用过')
    await transaction.execute(`
      UPDATE game_session_items
      SET used_count = used_count + 1, active_until = DATE_ADD(?, INTERVAL 20 SECOND)
      WHERE session_id = ? AND item_key = ? AND used_count < allowed_uses
    `, [currentTime, session.id, itemKey])
    const [updated] = await transaction.query('SELECT active_until AS activeUntil, allowed_uses AS allowedUses, used_count AS usedCount FROM game_session_items WHERE session_id = ? AND item_key = ?', [session.id, itemKey])
    const activeUntil = updated?.activeUntil ? new Date(updated.activeUntil) : new Date(currentTime.valueOf() + 20 * 1000)
    return {
      sessionId: session.id,
      itemKey,
      durationSeconds: 20,
      activeUntil: activeUntil.toISOString(),
      remainingUses: Math.max(0, Number(updated?.allowedUses || 0) - Number(updated?.usedCount || 0)),
    }
  })
}

export async function reviveGameSession(database, { userId, sessionId, now = new Date() }) {
  requirePositiveInteger(userId, 'INVALID_USER', '无效玩家')
  const currentTime = new Date(now)
  return database.transaction(async (transaction) => {
    const session = await lockGameSession(transaction, { userId, sessionId })
    const allowedUses = session.mode === 'endless' ? 3 : 1
    let [usage] = await transaction.query(`
      SELECT allowed_uses AS allowedUses, used_count AS usedCount
      FROM game_session_items WHERE session_id = ? AND item_key = 'revive-card' FOR UPDATE
    `, [session.id])
    if (!usage) {
      await transaction.execute('INSERT INTO game_session_items (session_id, user_id, item_key, allowed_uses) VALUES (?, ?, \'revive-card\', ?)', [session.id, userId, allowedUses])
      usage = { allowedUses, usedCount: 0 }
    }
    if (Number(usage.usedCount) >= Number(usage.allowedUses)) throw new BusinessError(409, 'REVIVE_LIMIT_REACHED', `本局最多使用 ${allowedUses} 张复活卡`)
    const inventory = await readInventoryRow(transaction, userId, 'revive-card')
    await consumeInventory(transaction, userId, inventory.itemId)
    await transaction.execute('UPDATE game_session_items SET used_count = used_count + 1, updated_at = ? WHERE session_id = ? AND item_key = ?', [currentTime, session.id, 'revive-card'])
    const usedCount = Number(usage.usedCount) + 1
    return {
      sessionId: session.id,
      itemKey: 'revive-card',
      usedCount,
      allowedUses: Number(usage.allowedUses),
      remainingUses: Math.max(0, Number(usage.allowedUses) - usedCount),
    }
  })
}

export async function grantPlayerPrivileges(database, { adminId, playerId, privileges }) {
  requirePositiveInteger(adminId, 'INVALID_ADMIN', '无效管理员')
  requirePositiveInteger(playerId, 'INVALID_PLAYER', '无效玩家')
  const nextPrivileges = booleanPrivileges(privileges)
  return database.transaction(async (transaction) => {
    const [player] = await transaction.query('SELECT id FROM users WHERE id = ? AND is_disabled = 0 FOR UPDATE', [playerId])
    if (!player) throw new BusinessError(404, 'PLAYER_NOT_FOUND', '玩家不存在或已被禁用')
    await transaction.execute(`
      INSERT INTO player_privileges (user_id, infinite_energy, infinite_coins, unlock_all_levels, granted_by, granted_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)
      ON DUPLICATE KEY UPDATE infinite_energy = VALUES(infinite_energy), infinite_coins = VALUES(infinite_coins),
        unlock_all_levels = VALUES(unlock_all_levels), granted_by = VALUES(granted_by), granted_at = CURRENT_TIMESTAMP, revoked_at = NULL
    `, [playerId, nextPrivileges.infiniteEnergy ? 1 : 0, nextPrivileges.infiniteCoins ? 1 : 0, nextPrivileges.unlockAllLevels ? 1 : 0, adminId])
    await transaction.execute(`
      INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
      VALUES (?, 'grant_privileges', 'player', ?, ?)
    `, [adminId, String(playerId), JSON.stringify(nextPrivileges)])
    return nextPrivileges
  })
}

export async function setTesterMode(database, { userId, enabled }) {
  requirePositiveInteger(userId, 'INVALID_PLAYER', '无效玩家')
  if (typeof enabled !== 'boolean') throw new BusinessError(422, 'INVALID_TESTER_MODE', '内测开关状态无效')
  return database.transaction(async (transaction) => {
    const [player] = await transaction.query('SELECT is_tester AS isTester FROM users WHERE id = ? FOR UPDATE', [userId])
    if (!player) throw new BusinessError(404, 'PLAYER_NOT_FOUND', '玩家不存在')
    if (!player.isTester) throw new BusinessError(403, 'TESTER_REQUIRED', '该账号没有内测权限')
    await transaction.execute('UPDATE users SET tester_mode_enabled = ? WHERE id = ?', [enabled ? 1 : 0, userId])
    return { enabled }
  })
}

export async function publishNotification(database, { adminId, title, body, recipientIds = null }) {
  requirePositiveInteger(adminId, 'INVALID_ADMIN', '无效管理员')
  const normalizedTitle = String(title || '').trim()
  const normalizedBody = String(body || '').trim()
  if (!normalizedTitle || normalizedTitle.length > 120 || !normalizedBody) throw new BusinessError(422, 'INVALID_NOTIFICATION', '通知标题或内容无效')
  const selectedIds = recipientIds === null ? null : uniqueRecipientIds(recipientIds)
  return database.transaction(async (transaction) => {
    const recipients = selectedIds === null
      ? await transaction.query("SELECT id FROM users WHERE role = 'player' AND is_disabled = 0 FOR UPDATE")
      : await transaction.query(`SELECT id FROM users WHERE id IN (${selectedIds.map(() => '?').join(', ')}) AND role = 'player' AND is_disabled = 0 FOR UPDATE`, selectedIds)
    if (!recipients.length || (selectedIds && recipients.length !== selectedIds.length)) throw new BusinessError(422, 'INVALID_RECIPIENTS', '接收玩家不存在或已被禁用')
    const audience = selectedIds === null ? 'all' : 'selected'
    const message = await transaction.execute('INSERT INTO notification_messages (title, body, audience, created_by) VALUES (?, ?, ?, ?)', [normalizedTitle, normalizedBody, audience, adminId])
    for (const recipient of recipients) await transaction.execute('INSERT INTO notification_recipients (notification_id, user_id) VALUES (?, ?)', [message.insertId, recipient.id])
    await transaction.execute(`INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, 'publish_notification', 'notification', ?, ?)`, [adminId, String(message.insertId), JSON.stringify({ audience, recipientCount: recipients.length })])
    return { id: message.insertId, audience, recipientCount: recipients.length }
  })
}

export async function listNotifications(database, userId) {
  requirePositiveInteger(userId, 'INVALID_PLAYER', '无效玩家')
  const rows = await database.query(`
    SELECT m.id, m.title, m.body, m.created_at AS createdAt, r.read_at AS readAt
    FROM notification_recipients r JOIN notification_messages m ON m.id = r.notification_id
    WHERE r.user_id = ? AND r.deleted_at IS NULL ORDER BY m.created_at DESC, m.id DESC
  `, [userId])
  return rows.map((row) => ({ ...row, read: Boolean(row.readAt) }))
}

export async function markNotificationRead(database, { userId, notificationId }) {
  requirePositiveInteger(userId, 'INVALID_PLAYER', '无效玩家')
  requirePositiveInteger(notificationId, 'INVALID_NOTIFICATION', '无效通知')
  const result = await database.execute('UPDATE notification_recipients SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE user_id = ? AND notification_id = ? AND deleted_at IS NULL', [userId, notificationId])
  if (!result.affectedRows) throw new BusinessError(404, 'NOTIFICATION_NOT_FOUND', '通知不存在')
}

export async function removeNotification(database, { userId, notificationId }) {
  requirePositiveInteger(userId, 'INVALID_PLAYER', '无效玩家')
  requirePositiveInteger(notificationId, 'INVALID_NOTIFICATION', '无效通知')
  return database.transaction(async (transaction) => {
    const deleted = await transaction.execute('DELETE FROM notification_recipients WHERE user_id = ? AND notification_id = ?', [userId, notificationId])
    if (!deleted.affectedRows) throw new BusinessError(404, 'NOTIFICATION_NOT_FOUND', '通知不存在')
    const [remaining] = await transaction.query('SELECT COUNT(*) AS count FROM notification_recipients WHERE notification_id = ? FOR UPDATE', [notificationId])
    if (remaining.count === 0) await transaction.execute('DELETE FROM notification_messages WHERE id = ?', [notificationId])
  })
}

export async function createRechargeOrder(database, { userId, productId, now = new Date(), orderNo = randomUUID() }) {
  requirePositiveInteger(userId, 'INVALID_PLAYER', '无效玩家')
  requirePositiveInteger(productId, 'INVALID_PRODUCT', '无效充值商品')
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)
  return database.transaction(async (transaction) => {
    const [product] = await transaction.query('SELECT qr_code_url AS qrCodeUrl FROM recharge_products WHERE id = ? AND enabled = 1 FOR UPDATE', [productId])
    if (!product?.qrCodeUrl) throw new BusinessError(404, 'PRODUCT_NOT_AVAILABLE', '充值商品当前不可用')
    const [player] = await transaction.query('SELECT id FROM users WHERE id = ? AND is_disabled = 0 FOR UPDATE', [userId])
    if (!player) throw new BusinessError(404, 'PLAYER_NOT_FOUND', '玩家不存在或已被禁用')
    await transaction.execute("UPDATE recharge_orders SET status = 'expired' WHERE user_id = ? AND status = 'pending' AND expires_at <= ?", [userId, now])
    await transaction.execute('INSERT INTO recharge_orders (order_no, user_id, product_id, qr_code_url, expires_at) VALUES (?, ?, ?, ?, ?)', [orderNo, userId, productId, product.qrCodeUrl, expiresAt])
    return { orderNo, productId, status: 'pending', qrCodeUrl: product.qrCodeUrl, expiresAt: expiresAt.toISOString() }
  })
}

function parseRechargeBenefits(value) {
  const benefits = typeof value === 'string' ? JSON.parse(value) : value
  if (Number.isFinite(Number(benefits?.coins))) return { benefitType: 'coins', benefitAmount: Math.max(1, Math.round(Number(benefits.coins))), benefitName: '' }
  return {
    benefitType: benefits?.benefitType,
    benefitAmount: Math.max(1, Math.round(Number(benefits?.benefitAmount) || 1)),
    benefitName: String(benefits?.benefitName || '').trim(),
  }
}

export async function readRechargeOrder(database, { userId, orderNo, isAdmin = false, now = new Date() }) {
  requirePositiveInteger(userId, 'INVALID_PLAYER', '无效玩家')
  if (typeof orderNo !== 'string' || !orderNo.trim()) throw new BusinessError(422, 'INVALID_ORDER', '无效订单号')
  const result = await database.transaction(async (transaction) => {
    const [order] = await transaction.query(`
    SELECT o.order_no AS orderNo, o.user_id AS userId, o.product_id AS productId, o.status,
           o.qr_code_url AS qrCodeUrl, o.expires_at AS expiresAt, o.paid_at AS paidAt,
           p.display_name AS displayName, p.price_cents AS priceCents, p.benefits
    FROM recharge_orders o JOIN recharge_products p ON p.id = o.product_id
    WHERE o.order_no = ?
    `, [orderNo.trim()])
    if (!order || (!isAdmin && Number(order.userId) !== Number(userId))) throw new BusinessError(404, 'ORDER_NOT_FOUND', '充值订单不存在')
    if (order.status === 'pending' && new Date(order.expiresAt).valueOf() <= new Date(now).valueOf()) {
      await transaction.execute("UPDATE recharge_orders SET status = 'expired' WHERE order_no = ? AND status = 'pending'", [order.orderNo])
      order.status = 'expired'
    }
    return order
  })
  return { ...result, benefits: parseRechargeBenefits(result.benefits), expiresAt: new Date(result.expiresAt).toISOString(), paidAt: result.paidAt ? new Date(result.paidAt).toISOString() : null }
}

export async function cancelRechargeOrder(database, { userId, orderNo }) {
  requirePositiveInteger(userId, 'INVALID_PLAYER', '无效玩家')
  if (typeof orderNo !== 'string' || !orderNo.trim()) throw new BusinessError(422, 'INVALID_ORDER', '无效订单号')
  return database.transaction(async (transaction) => {
    const [order] = await transaction.query('SELECT order_no AS orderNo, user_id AS userId, status FROM recharge_orders WHERE order_no = ? FOR UPDATE', [orderNo.trim()])
    if (!order || Number(order.userId) !== Number(userId)) throw new BusinessError(404, 'ORDER_NOT_FOUND', '充值订单不存在')
    if (order.status === 'cancelled') return { orderNo: order.orderNo, status: 'cancelled', replayed: true }
    if (order.status !== 'pending') throw new BusinessError(409, 'ORDER_NOT_CANCELLABLE', '订单当前不可取消')
    await transaction.execute("UPDATE recharge_orders SET status = 'cancelled' WHERE order_no = ? AND status = 'pending'", [order.orderNo])
    return { orderNo: order.orderNo, status: 'cancelled', replayed: false }
  })
}

export async function confirmRechargeOrder(database, { adminId, orderNo, now = new Date() }) {
  requirePositiveInteger(adminId, 'INVALID_ADMIN', '无效管理员')
  if (typeof orderNo !== 'string' || !orderNo.trim()) throw new BusinessError(422, 'INVALID_ORDER', '无效订单号')
  return database.transaction(async (transaction) => {
    const [order] = await transaction.query(`
      SELECT o.order_no AS orderNo, o.user_id AS userId, o.status, o.expires_at AS expiresAt,
             p.benefits, p.display_name AS displayName, p.price_cents AS priceCents
      FROM recharge_orders o JOIN recharge_products p ON p.id = o.product_id
      WHERE o.order_no = ? FOR UPDATE
    `, [orderNo.trim()])
    if (!order) throw new BusinessError(404, 'ORDER_NOT_FOUND', '充值订单不存在')
    if (order.status === 'paid') return { orderNo: order.orderNo, status: 'paid', granted: true, replayed: true }
    if (order.status !== 'pending') throw new BusinessError(409, 'ORDER_NOT_PAYABLE', '订单当前不可确认')
    if (new Date(order.expiresAt).valueOf() <= new Date(now).valueOf()) {
      await transaction.execute("UPDATE recharge_orders SET status = 'expired' WHERE order_no = ? AND status = 'pending'", [order.orderNo])
      throw new BusinessError(409, 'ORDER_EXPIRED', '充值订单已过期')
    }
    const [player] = await transaction.query('SELECT id, coins, energy, max_energy AS maxEnergy FROM users WHERE id = ? AND is_disabled = 0 FOR UPDATE', [order.userId])
    if (!player) throw new BusinessError(404, 'PLAYER_NOT_FOUND', '玩家不存在或已被禁用')
    const benefits = parseRechargeBenefits(order.benefits)
    if (!['coins', 'energy', 'item', 'permanent-free-entry'].includes(benefits.benefitType)) throw new BusinessError(422, 'UNSUPPORTED_BENEFIT', '该充值权益暂不支持自动发放')
    if (benefits.benefitType === 'coins') {
      const coins = Number(player.coins) + benefits.benefitAmount
      await transaction.execute('UPDATE users SET coins = ? WHERE id = ?', [coins, player.id])
      await transaction.execute(`INSERT INTO wallet_ledger (user_id, transaction_type, reference_type, reference_id, coins_delta, balance_after) VALUES (?, 'recharge', 'recharge_order', ?, ?, ?)`, [player.id, order.orderNo, benefits.benefitAmount, coins])
    } else if (benefits.benefitType === 'energy') {
      const energy = Math.min(Number(player.maxEnergy), Number(player.energy) + benefits.benefitAmount)
      await transaction.execute('UPDATE users SET energy = ?, energy_recovery_started_at = IF(energy >= max_energy, NULL, energy_recovery_started_at) WHERE id = ?', [energy, player.id])
    } else if (benefits.benefitType === 'item') {
      const [item] = await transaction.query('SELECT id FROM item_catalog WHERE item_key = ? AND enabled = 1 FOR UPDATE', [benefits.benefitName])
      if (!item) throw new BusinessError(404, 'BENEFIT_ITEM_NOT_FOUND', '充值权益道具不存在')
      await transaction.execute('INSERT INTO player_inventory (user_id, item_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)', [player.id, item.id, benefits.benefitAmount])
    } else {
      await transaction.execute(`INSERT INTO player_privileges (user_id, infinite_energy, granted_by, granted_at, revoked_at) VALUES (?, 1, ?, CURRENT_TIMESTAMP, NULL) ON DUPLICATE KEY UPDATE infinite_energy = 1, granted_by = VALUES(granted_by), granted_at = CURRENT_TIMESTAMP, revoked_at = NULL`, [player.id, adminId])
    }
    await transaction.execute("UPDATE recharge_orders SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE order_no = ?", [order.orderNo])
    await transaction.execute("INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, 'confirm_recharge', 'recharge_order', ?, ?)", [adminId, order.orderNo, JSON.stringify({ userId: player.id, benefits })])
    return { orderNo: order.orderNo, status: 'paid', granted: true, replayed: false }
  })
}
