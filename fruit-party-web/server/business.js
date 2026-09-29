import { randomUUID } from 'node:crypto'
import { BusinessError } from './economy.js'
import { consumeGameItemsInTransaction } from './items.js'

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
