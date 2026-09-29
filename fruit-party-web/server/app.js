import cors from 'cors'
import express from 'express'
import { createDatabase, readLeaderboards, readPlayerState, seedDatabase } from './database.js'
import { USERNAME_PATTERN, hashPassword, issueToken, readToken, validateCredentials, verifyPassword } from './auth.js'
import { calculateSettlement } from './scoring.js'
import { createRealtimeHub } from './realtime.js'
import { createRechargeOrder, enterGame, grantPlayerPrivileges, listNotifications, markNotificationRead, publishNotification, removeNotification, setTesterMode } from './business.js'
import { purchaseItem } from './economy.js'
import { useInventoryItem } from './items.js'

const JWT_SECRET = process.env.JWT_SECRET || 'fruit-party-local-development-secret'
const SESSION_COOKIE = 'fruit_party_session'

function apiError(res, status, code, message) {
  return res.status(status).json({ data: null, error: { code, message } })
}

function requestError(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

function sessionToken(req) {
  const bearerToken = req.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (bearerToken) return bearerToken
  return req.get('Cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1)
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 12 * 60 * 60 * 1000, path: '/' })
}

const AUDIT_ACTION_LABELS = {
  update_item_price: '调整道具价格',
  grant_privileges: '更新玩家特殊权限',
  publish_notification: '发布通知',
  create_recharge_product: '新增充值商品',
  game_settlement: '游戏结算完成',
  wallet_change: '金币余额变动',
}

function positivePage(value, fallback, maximum) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, maximum) : fallback
}

function parseCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null
  return parsed
}

function calendarDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function advanceCalendar(date, unit) {
  const next = new Date(date)
  if (unit === 'day') next.setUTCDate(next.getUTCDate() + 1)
  else if (unit === 'week') next.setUTCDate(next.getUTCDate() + 7)
  else if (unit === 'month') next.setUTCMonth(next.getUTCMonth() + 1)
  else if (unit === 'quarter') next.setUTCMonth(next.getUTCMonth() + 3)
  else next.setUTCFullYear(next.getUTCFullYear() + 1)
  return next
}

function floorCalendarBucket(date, aggregation) {
  const bucket = new Date(date)
  if (aggregation === 'week') bucket.setUTCDate(bucket.getUTCDate() - ((bucket.getUTCDay() + 6) % 7))
  if (aggregation === 'month' || aggregation === 'quarter' || aggregation === 'year') bucket.setUTCDate(1)
  if (aggregation === 'quarter') bucket.setUTCMonth(Math.floor(bucket.getUTCMonth() / 3) * 3)
  if (aggregation === 'year') bucket.setUTCMonth(0)
  return bucket
}

function calendarBucketLabel(date, aggregation) {
  if (aggregation === 'day') return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
  if (aggregation === 'week') return `${date.getUTCMonth() + 1}/${date.getUTCDate()} 周`
  if (aggregation === 'month') return `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}`
  if (aggregation === 'quarter') return `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth() / 3) + 1}`
  return `${date.getUTCFullYear()}年`
}

function createRevenueBuckets(startDate, endDate, aggregation) {
  const first = floorCalendarBucket(startDate, aggregation)
  const last = floorCalendarBucket(endDate, aggregation)
  const buckets = []
  for (let cursor = first; cursor <= last; cursor = advanceCalendar(cursor, aggregation)) {
    buckets.push({ key: calendarDateKey(cursor), label: calendarBucketLabel(cursor, aggregation), valueCents: 0 })
  }
  return buckets
}

function parseAuditDetails(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return {} }
}

function parseRechargeBenefits(value) {
  const benefits = typeof value === 'string' ? parseAuditDetails(value) : value
  if (Number.isFinite(Number(benefits?.coins))) return { benefitType: 'coins', benefitAmount: Math.max(1, Math.round(Number(benefits.coins))), benefitName: '' }
  if (benefits?.infiniteEnergy === true) return { benefitType: 'permanent-free-entry', benefitAmount: 1, benefitName: '' }
  const benefitType = benefits?.benefitType
  if (!['coins', 'energy', 'item', 'permanent-free-entry', 'custom'].includes(benefitType)) return null
  const benefitAmount = Math.max(1, Math.round(Number(benefits.benefitAmount) || 1))
  return { benefitType, benefitAmount, benefitName: String(benefits.benefitName || '').trim() }
}

function presentRechargeProduct(product) {
  return {
    ...product,
    benefits: parseRechargeBenefits(product.benefits) || product.benefits,
    enabled: Boolean(product.enabled),
  }
}

export async function createApp({ databaseName, databaseConfig, seed = false } = {}) {
  const db = await createDatabase({ databaseName, config: databaseConfig })
  if (seed) await seedDatabase(db, hashPassword)
  const realtime = createRealtimeHub()
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  const authenticate = async (req, res, next) => {
    const token = sessionToken(req)
    if (!token) return apiError(res, 401, 'AUTH_REQUIRED', '请先登录')
    try {
      req.auth = readToken(token, JWT_SECRET)
      const [account] = await db.query('SELECT id, role, is_disabled AS isDisabled FROM users WHERE id = ?', [req.auth.sub])
      if (!account) return apiError(res, 401, 'INVALID_TOKEN', '登录状态已失效')
      if (account.isDisabled) return apiError(res, 403, 'ACCOUNT_DISABLED', '该账号已被禁用')
      req.account = account
      return next()
    } catch {
      return apiError(res, 401, 'INVALID_TOKEN', '登录状态已失效')
    }
  }

  const requireAdmin = (req, res, next) => {
    if (req.account?.role !== 'admin') return apiError(res, 403, 'ADMIN_REQUIRED', '需要管理员权限')
    return next()
  }

  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>水果切切乐 API</title></head>
  <body>
    <h1>水果切切乐 API 服务已启动</h1>
    <p>这里是后端 API 服务，不提供游戏页面。</p>
    <p>本地开发请打开 <a href="http://127.0.0.1:5174">http://127.0.0.1:5174</a>。</p>
    <p>健康检查：<a href="/api/health">/api/health</a></p>
  </body>
</html>`)
  })

  app.get('/api/health', async (_req, res) => res.json({ data: { status: 'ok', database: 'mysql' }, error: null }))

  app.post('/api/auth/login', async (req, res) => {
    const { username = '', password = '', acceptedTerms = false } = req.body || {}
    if (!acceptedTerms) return apiError(res, 422, 'TERMS_REQUIRED', '请先阅读并同意用户协议')
    const [user] = await db.query('SELECT id, username, password_hash AS passwordHash, role, is_disabled AS isDisabled FROM users WHERE username = ?', [username.trim()])
    if (!user || !verifyPassword(password, user.passwordHash)) return apiError(res, 401, 'INVALID_CREDENTIALS', '用户名或密码错误')
    if (user.isDisabled) return apiError(res, 403, 'ACCOUNT_DISABLED', '该账号已被禁用')
    const token = issueToken(user, JWT_SECRET)
    setSessionCookie(res, token)
    return res.json({ data: { token, player: { id: user.id, username: user.username, role: user.role } }, error: null })
  })

  app.post('/api/auth/register', async (req, res) => {
    const { username = '', password = '', acceptedTerms = false } = req.body || {}
    const validationError = validateCredentials({ username: username.trim(), password })
    if (validationError) return apiError(res, 422, 'INVALID_CREDENTIALS', validationError)
    if (!acceptedTerms) return apiError(res, 422, 'TERMS_REQUIRED', '请先阅读并同意用户协议')
    try {
      const user = await db.transaction(async (transaction) => {
        const result = await transaction.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username.trim(), hashPassword(password)])
        for (const mode of ['normal', 'hard']) for (let level = 1; level <= 10; level += 1) {
          await transaction.execute('INSERT INTO level_progress (user_id, mode, level_number, unlocked) VALUES (?, ?, ?, ?)', [result.insertId, mode, level, level === 1 ? 1 : 0])
        }
        const [created] = await transaction.query('SELECT id, username, role FROM users WHERE id = ?', [result.insertId])
        return created
      })
      const token = issueToken(user, JWT_SECRET)
      setSessionCookie(res, token)
      return res.status(201).json({ data: { token, player: user }, error: null })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return apiError(res, 409, 'USERNAME_TAKEN', '用户名已被注册，请重新取名')
      throw error
    }
  })

  app.get('/api/me/state', authenticate, async (req, res) => {
    const state = await readPlayerState(db, req.auth.sub)
    if (!state) return apiError(res, 404, 'PLAYER_NOT_FOUND', '玩家不存在')
    return res.json({ data: state, error: null })
  })

  app.patch('/api/me/profile', authenticate, async (req, res, next) => {
    try {
      const avatarUrl = typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl.trim() : null
      const username = typeof req.body?.username === 'string' ? req.body.username.trim() : null
      if (avatarUrl !== null && avatarUrl.length > 2048) return apiError(res, 422, 'INVALID_AVATAR', '头像信息过长')
      if (username !== null && !USERNAME_PATTERN.test(username)) return apiError(res, 422, 'INVALID_USERNAME', '用户名需为 2-16 位中文、字母、数字或下划线')
      if (username === null && avatarUrl === null) return apiError(res, 422, 'EMPTY_PROFILE_UPDATE', '请提供需要修改的资料')
      await db.execute('UPDATE users SET username = COALESCE(?, username), avatar_url = COALESCE(?, avatar_url) WHERE id = ?', [username, avatarUrl, req.auth.sub])
      const state = await readPlayerState(db, req.auth.sub)
      realtime.publish(req.auth.sub, 'player-state', state)
      return res.json({ data: state, error: null })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return apiError(res, 409, 'USERNAME_TAKEN', '用户名已被注册，请重新取名')
      return next(error)
    }
  })

  app.patch('/api/me/testing-mode', authenticate, async (req, res, next) => {
    try {
      await setTesterMode(db, { userId: Number(req.auth.sub), enabled: req.body?.enabled })
      const state = await readPlayerState(db, req.auth.sub)
      realtime.publish(req.auth.sub, 'player-state', state)
      return res.json({ data: state, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/leaderboards', async (_req, res) => res.json({ data: await readLeaderboards(db), error: null }))

  app.post('/api/game/entries', authenticate, async (req, res, next) => {
    try {
      const entry = await enterGame(db, { userId: Number(req.auth.sub), mode: req.body?.mode, levelNumber: req.body?.levelNumber, itemKeys: req.body?.itemKeys || [] })
      const state = await readPlayerState(db, req.auth.sub)
      realtime.publish(req.auth.sub, 'player-state', state)
      return res.status(201).json({ data: entry, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/shop/items', authenticate, async (_req, res, next) => {
    try {
      const items = await db.query(`SELECT id, item_key AS itemKey, display_name AS displayName, description, price_coins AS priceCoins,
        max_purchase_quantity AS maxPurchaseQuantity, display_order AS displayOrder FROM item_catalog WHERE enabled = 1 ORDER BY display_order, id`)
      return res.json({ data: items, error: null })
    } catch (error) { return next(error) }
  })

  app.post('/api/shop/purchases', authenticate, async (req, res, next) => {
    try {
      const result = await purchaseItem(db, { userId: Number(req.auth.sub), ...req.body })
      const state = await readPlayerState(db, req.auth.sub)
      realtime.publish(req.auth.sub, 'player-state', state)
      return res.status(result.replayed ? 200 : 201).json({ data: result, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/me/inventory', authenticate, async (req, res, next) => {
    try {
      const inventory = await db.query(`SELECT i.item_id AS itemId, c.item_key AS itemKey, c.display_name AS displayName,
        c.description, i.quantity FROM player_inventory i JOIN item_catalog c ON c.id = i.item_id WHERE i.user_id = ? ORDER BY c.display_order, c.id`, [req.auth.sub])
      return res.json({ data: inventory, error: null })
    } catch (error) { return next(error) }
  })

  app.post('/api/me/inventory/use', authenticate, async (req, res, next) => {
    try {
      const result = await useInventoryItem(db, { userId: Number(req.auth.sub), itemKey: req.body?.itemKey })
      const state = await readPlayerState(db, req.auth.sub)
      realtime.publish(req.auth.sub, 'player-state', state)
      return res.status(200).json({ data: result, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/notifications', authenticate, async (req, res, next) => {
    try { return res.json({ data: await listNotifications(db, Number(req.auth.sub)), error: null }) } catch (error) { return next(error) }
  })

  app.patch('/api/notifications/:notificationId/read', authenticate, async (req, res, next) => {
    try {
      await markNotificationRead(db, { userId: Number(req.auth.sub), notificationId: Number(req.params.notificationId) })
      return res.status(204).end()
    } catch (error) { return next(error) }
  })

  app.delete('/api/notifications/:notificationId', authenticate, async (req, res, next) => {
    try {
      await removeNotification(db, { userId: Number(req.auth.sub), notificationId: Number(req.params.notificationId) })
      return res.status(204).end()
    } catch (error) { return next(error) }
  })

  app.get('/api/recharge-products', authenticate, async (_req, res, next) => {
    try {
      const products = await db.query('SELECT id, display_name AS displayName, description, price_cents AS priceCents, benefits, qr_code_url AS qrCodeUrl, display_order AS displayOrder FROM recharge_products WHERE enabled = 1 ORDER BY display_order, id')
      return res.json({ data: products.map((product) => ({ ...product, benefits: typeof product.benefits === 'string' ? JSON.parse(product.benefits) : product.benefits })), error: null })
    } catch (error) { return next(error) }
  })

  app.post('/api/recharge-orders', authenticate, async (req, res, next) => {
    try { return res.status(201).json({ data: await createRechargeOrder(db, { userId: Number(req.auth.sub), productId: Number(req.body?.productId) }), error: null }) } catch (error) { return next(error) }
  })

  app.get('/api/admin/dashboard', authenticate, requireAdmin, async (_req, res, next) => {
    try {
      const [[players], [attempts], [coins], [todayAttempts], [todayActive], modeRows, trendRows] = await Promise.all([
        db.query('SELECT COUNT(*) AS totalPlayers, SUM(is_disabled = 0) AS activePlayers FROM users WHERE role = \'player\''),
        db.query('SELECT COUNT(*) AS gameAttempts FROM game_attempts'),
        db.query('SELECT COALESCE(SUM(coins_delta), 0) AS coinsIssued FROM wallet_ledger WHERE coins_delta > 0'),
        db.query('SELECT COUNT(*) AS todayGameAttempts FROM game_attempts WHERE created_at >= CURRENT_DATE'),
        db.query('SELECT COUNT(DISTINCT user_id) AS todayActivePlayers FROM game_attempts WHERE created_at >= CURRENT_DATE'),
        db.query('SELECT mode, COUNT(*) AS attempts FROM game_attempts WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) GROUP BY mode'),
        db.query('SELECT DATE(created_at) AS activityDate, COUNT(DISTINCT user_id) AS activePlayers FROM game_attempts WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY) GROUP BY DATE(created_at)'),
      ])
      const modeAttempts = Object.fromEntries(modeRows.map((row) => [row.mode, Number(row.attempts)]))
      const totalModeAttempts = Object.values(modeAttempts).reduce((sum, value) => sum + value, 0)
      const toDateKey = (date) => new Date(date).toISOString().slice(0, 10)
      const activityByDate = Object.fromEntries(trendRows.map((row) => [toDateKey(row.activityDate), Number(row.activePlayers)]))
      const activityTrend = Array.from({ length: 7 }, (_, index) => {
        const date = new Date()
        date.setHours(0, 0, 0, 0)
        date.setDate(date.getDate() - 6 + index)
        return { label: `${date.getMonth() + 1}/${date.getDate()}`, value: activityByDate[toDateKey(date)] || 0 }
      })
      return res.json({ data: {
        totalPlayers: Number(players?.totalPlayers || 0),
        activePlayers: Number(players?.activePlayers || 0),
        gameAttempts: Number(attempts?.gameAttempts || 0),
        todayGameAttempts: Number(todayAttempts?.todayGameAttempts || 0),
        todayActivePlayers: Number(todayActive?.todayActivePlayers || 0),
        coinsIssued: Number(coins?.coinsIssued || 0),
        activityTrend,
        modeDistribution: ['normal', 'hard', 'endless'].map((mode) => ({ mode, attempts: modeAttempts[mode] || 0, percentage: totalModeAttempts ? Math.round((modeAttempts[mode] || 0) * 100 / totalModeAttempts) : 0 })),
      }, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/admin/players', authenticate, requireAdmin, async (_req, res) => {
    const players = await db.query(`SELECT u.id, u.username, u.role, u.is_tester AS isTester, u.is_disabled AS isDisabled,
      u.coins, u.energy, u.created_at AS createdAt,
      COALESCE(MAX(CASE WHEN p.mode = 'normal' AND p.unlocked = 1 THEN p.level_number END), 0) AS normalHighestLevel,
      COALESCE(MAX(CASE WHEN p.mode = 'hard' AND p.unlocked = 1 THEN p.level_number END), 0) AS hardHighestLevel
      FROM users u LEFT JOIN level_progress p ON p.user_id = u.id
      GROUP BY u.id ORDER BY u.created_at DESC, u.id DESC`)
    return res.json({ data: players.map((player) => ({ ...player, isTester: Boolean(player.isTester), isDisabled: Boolean(player.isDisabled) })), error: null })
  })

  app.get('/api/admin/permissions', authenticate, requireAdmin, async (req, res, next) => {
    try {
      const page = positivePage(req.query.page, 1, 1000000)
      const pageSize = positivePage(req.query.pageSize, 6, 100)
      const keyword = String(req.query.keyword || '').trim()
      const keywordSql = keyword ? ' AND u.username LIKE ?' : ''
      const keywordValues = keyword ? [`%${keyword}%`] : []
      const players = await db.query(`SELECT u.id, u.username, u.coins, u.energy, u.created_at AS createdAt,
        COALESCE(p.infinite_energy, 0) AS infiniteEnergy, COALESCE(p.infinite_coins, 0) AS infiniteCoins,
        COALESCE(p.unlock_all_levels, 0) AS unlockAllLevels
        FROM users u LEFT JOIN player_privileges p ON p.user_id = u.id
        WHERE u.role = 'player' AND u.is_disabled = 0${keywordSql} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`, [...keywordValues, pageSize, (page - 1) * pageSize])
      const [count] = await db.query(`SELECT COUNT(*) AS total FROM users u WHERE u.role = 'player' AND u.is_disabled = 0${keywordSql}`, keywordValues)
      return res.json({ data: { items: players.map((player) => ({
        ...player,
        infiniteEnergy: Boolean(player.infiniteEnergy),
        infiniteCoins: Boolean(player.infiniteCoins),
        unlockAllLevels: Boolean(player.unlockAllLevels),
      })), page, pageSize, total: Number(count.total) }, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/admin/items', authenticate, requireAdmin, async (_req, res, next) => {
    try {
      const items = await db.query(`SELECT id, item_key AS itemKey, display_name AS displayName, description,
        price_coins AS priceCoins, max_purchase_quantity AS maxPurchaseQuantity, enabled, display_order AS displayOrder
        FROM item_catalog ORDER BY display_order, id`)
      return res.json({ data: items.map((item) => ({ ...item, enabled: Boolean(item.enabled) })), error: null })
    } catch (error) { return next(error) }
  })

  app.patch('/api/admin/items/:itemId/price', authenticate, requireAdmin, async (req, res, next) => {
    const itemId = Number(req.params.itemId)
    const priceCoins = Number(req.body?.priceCoins)
    if (!Number.isInteger(itemId) || itemId < 1) return apiError(res, 422, 'INVALID_ITEM_ID', '无效道具')
    if (!Number.isInteger(priceCoins) || priceCoins < 1) return apiError(res, 422, 'INVALID_ITEM_PRICE', '价格必须是正整数')
    try {
      const updated = await db.transaction(async (transaction) => {
        const result = await transaction.execute('UPDATE item_catalog SET price_coins = ? WHERE id = ?', [priceCoins, itemId])
        if (!result.affectedRows) throw requestError(404, 'ITEM_NOT_FOUND', '道具不存在')
        await transaction.execute(`INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
          VALUES (?, 'update_item_price', 'item_catalog', ?, ?)`, [req.auth.sub, String(itemId), JSON.stringify({ priceCoins })])
        const [item] = await transaction.query(`SELECT id, item_key AS itemKey, display_name AS displayName, description,
          price_coins AS priceCoins, max_purchase_quantity AS maxPurchaseQuantity, enabled, display_order AS displayOrder
          FROM item_catalog WHERE id = ?`, [itemId])
        return { ...item, enabled: Boolean(item.enabled) }
      })
      return res.json({ data: updated, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/admin/audit-logs', authenticate, requireAdmin, async (req, res, next) => {
    const type = ['all', 'admin', 'player', 'system'].includes(req.query.type) ? req.query.type : 'all'
    const page = positivePage(req.query.page, 1, 1000000)
    const pageSize = positivePage(req.query.pageSize, 20, 100)
    const auditRowsSql = `
      SELECT l.id, 'admin' AS type, u.username AS actor, l.target_id AS target, l.action AS action_key,
             l.details AS details, l.created_at AS created_at
      FROM admin_audit_logs l JOIN users u ON u.id = l.admin_id
      UNION ALL
      SELECT a.id, 'player' AS type, u.username AS actor,
             CONCAT(a.mode, IF(a.level_number IS NULL, '', CONCAT(' ', a.level_number, '关'))) AS target,
             'game_settlement' AS action_key,
             JSON_OBJECT('mode', a.mode, 'levelNumber', a.level_number, 'finalScore', a.final_score, 'passed', a.passed) AS details,
             a.created_at AS created_at
      FROM game_attempts a JOIN users u ON u.id = a.user_id
      UNION ALL
      SELECT l.id, 'system' AS type, u.username AS actor, l.reference_id AS target,
             'wallet_change' AS action_key,
             JSON_OBJECT('transactionType', l.transaction_type, 'coinsDelta', l.coins_delta, 'balanceAfter', l.balance_after) AS details,
             l.created_at AS created_at
      FROM wallet_ledger l JOIN users u ON u.id = l.user_id
    `
    const filterSql = type === 'all' ? '' : ' WHERE type = ?'
    const filterValues = type === 'all' ? [] : [type]
    try {
      const [[count], rows] = await Promise.all([
        db.query(`SELECT COUNT(*) AS total FROM (${auditRowsSql}) AS audit_rows${filterSql}`, filterValues),
        db.query(`SELECT * FROM (${auditRowsSql}) AS audit_rows${filterSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [...filterValues, pageSize, (page - 1) * pageSize]),
      ])
      const items = rows.map((row) => {
        const details = parseAuditDetails(row.details)
        const detail = row.action_key === 'game_settlement'
          ? `得分 ${Number(details.finalScore || 0).toLocaleString('zh-CN')} · ${details.passed ? '通关' : '未通关'}`
          : row.action_key === 'wallet_change'
            ? `${details.transactionType || '金币变动'} · ${Number(details.coinsDelta || 0) >= 0 ? '+' : ''}${Number(details.coinsDelta || 0)} 金币`
            : Object.entries(details).map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ')
        return {
          id: `${row.type}-${row.id}`,
          type: row.type,
          typeLabel: row.type === 'admin' ? '后台操作' : row.type === 'player' ? '玩家游戏' : '系统日志',
          actor: row.actor,
          target: row.target || '',
          action: AUDIT_ACTION_LABELS[row.action_key] || row.action_key,
          detail,
          time: new Date(row.created_at).toISOString(),
        }
      })
      return res.json({ data: { items, page, pageSize, total: Number(count.total) }, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/admin/players/:playerId/audit-logs', authenticate, requireAdmin, async (req, res, next) => {
    const playerId = Number(req.params.playerId)
    const type = ['all', 'game', 'account'].includes(req.query.type) ? req.query.type : 'all'
    const page = positivePage(req.query.page, 1, 1000000)
    const pageSize = positivePage(req.query.pageSize, 20, 100)
    if (!Number.isInteger(playerId) || playerId < 1) return apiError(res, 422, 'INVALID_PLAYER_ID', '无效玩家')
    const recordsSql = `
      SELECT id, 'game' AS category, mode, level_number AS levelNumber, final_score AS finalScore,
             passed, created_at AS createdAt, NULL AS coinsDelta, NULL AS balanceAfter
      FROM game_attempts WHERE user_id = ?
      UNION ALL
      SELECT id, 'account' AS category, NULL AS mode, NULL AS levelNumber, NULL AS finalScore,
             NULL AS passed, created_at AS createdAt, coins_delta AS coinsDelta, balance_after AS balanceAfter
      FROM wallet_ledger WHERE user_id = ?
    `
    const filterSql = type === 'all' ? '' : ' WHERE category = ?'
    const filterValues = type === 'all' ? [playerId, playerId] : [playerId, playerId, type]
    try {
      const [[player], [count], rows] = await Promise.all([
        db.query("SELECT id FROM users WHERE id = ? AND role = 'player'", [playerId]),
        db.query(`SELECT COUNT(*) AS total FROM (${recordsSql}) AS player_audit${filterSql}`, filterValues),
        db.query(`SELECT * FROM (${recordsSql}) AS player_audit${filterSql} ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?`, [...filterValues, pageSize, (page - 1) * pageSize]),
      ])
      if (!player) return apiError(res, 404, 'PLAYER_NOT_FOUND', '玩家不存在')
      const items = rows.map((row) => row.category === 'game'
        ? {
          id: `game-${row.id}`,
          category: 'game',
          categoryLabel: '对局记录',
          action: `${row.mode === 'hard' ? '困难' : '普通'}模式第 ${row.levelNumber} 关结算`,
          detail: `得分 ${Number(row.finalScore).toLocaleString('zh-CN')} · ${row.passed ? '通关' : '未通关'}`,
          time: new Date(row.createdAt).toISOString(),
          balanceBefore: null,
          balanceAfter: null,
        }
        : {
          id: `account-${row.id}`,
          category: 'account',
          categoryLabel: '账户账务',
          action: '金币余额变动',
          detail: `${Number(row.coinsDelta) >= 0 ? '+' : ''}${Number(row.coinsDelta)} 金币`,
          time: new Date(row.createdAt).toISOString(),
          balanceBefore: null,
          balanceAfter: Number(row.balanceAfter),
        })
      return res.json({ data: { items, page, pageSize, total: Number(count.total) }, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/admin/revenue', authenticate, requireAdmin, async (req, res, next) => {
    const startDate = parseCalendarDate(req.query.startDate)
    const endDate = parseCalendarDate(req.query.endDate)
    const aggregation = ['day', 'week', 'month', 'quarter', 'year'].includes(req.query.aggregation) ? req.query.aggregation : null
    if (!startDate || !endDate || startDate > endDate || !aggregation) return apiError(res, 422, 'INVALID_REVENUE_RANGE', '统计日期范围或汇总单位无效')
    const afterEndDate = new Date(endDate)
    afterEndDate.setUTCDate(afterEndDate.getUTCDate() + 1)
    try {
      const [paidOrders, [wallet], [orderCount]] = await Promise.all([
        db.query(`SELECT o.paid_at AS paidAt, p.price_cents AS priceCents
          FROM recharge_orders o JOIN recharge_products p ON p.id = o.product_id
          WHERE o.status = 'paid' AND o.paid_at >= ? AND o.paid_at < ?`, [calendarDateKey(startDate), calendarDateKey(afterEndDate)]),
        db.query('SELECT COALESCE(SUM(coins_delta), 0) AS coinsIssued FROM wallet_ledger WHERE coins_delta > 0 AND created_at >= ? AND created_at < ?', [calendarDateKey(startDate), calendarDateKey(afterEndDate)]),
        db.query("SELECT COUNT(*) AS paidOrderCount FROM recharge_orders WHERE status = 'paid' AND paid_at >= ? AND paid_at < ?", [calendarDateKey(startDate), calendarDateKey(afterEndDate)]),
      ])
      const points = createRevenueBuckets(startDate, endDate, aggregation)
      const pointsByKey = new Map(points.map((point) => [point.key, point]))
      for (const order of paidOrders) {
        const paidAt = new Date(order.paidAt)
        const key = calendarDateKey(floorCalendarBucket(paidAt, aggregation))
        const point = pointsByKey.get(key)
        if (point) point.valueCents += Number(order.priceCents)
      }
      return res.json({ data: {
        aggregation,
        totalRevenueCents: points.reduce((total, point) => total + point.valueCents, 0),
        paidOrderCount: Number(orderCount.paidOrderCount),
        coinsIssued: Number(wallet.coinsIssued),
        points,
      }, error: null })
    } catch (error) { return next(error) }
  })

  app.patch('/api/admin/players/:playerId/status', authenticate, requireAdmin, async (req, res) => {
    const playerId = Number(req.params.playerId)
    const disabled = req.body?.disabled === true
    if (!Number.isInteger(playerId) || playerId < 1) return apiError(res, 422, 'INVALID_PLAYER_ID', '无效玩家')
    if (playerId === Number(req.auth.sub) && disabled) return apiError(res, 422, 'CANNOT_DISABLE_SELF', '不能禁用当前管理员账号')
    const result = await db.execute('UPDATE users SET is_disabled = ?, disabled_at = IF(?, CURRENT_TIMESTAMP, NULL) WHERE id = ?', [disabled ? 1 : 0, disabled ? 1 : 0, playerId])
    if (!result.affectedRows) return apiError(res, 404, 'PLAYER_NOT_FOUND', '玩家不存在')
    realtime.publish(playerId, disabled ? 'account-disabled' : 'account-enabled', { playerId })
    realtime.publishAll('leaderboards', await readLeaderboards(db))
    return res.json({ data: { playerId, disabled }, error: null })
  })

  app.patch('/api/admin/players/:playerId/privileges', authenticate, requireAdmin, async (req, res, next) => {
    const playerId = Number(req.params.playerId)
    try {
      const [admin] = await db.query('SELECT password_hash AS passwordHash FROM users WHERE id = ?', [req.auth.sub])
      if (!admin || !verifyPassword(req.body?.adminPassword || '', admin.passwordHash)) return apiError(res, 401, 'ADMIN_PASSWORD_INVALID', '管理员密码不正确')
      const privileges = await grantPlayerPrivileges(db, { adminId: Number(req.auth.sub), playerId, privileges: req.body?.privileges })
      realtime.publish(playerId, 'player-state', await readPlayerState(db, playerId))
      return res.json({ data: privileges, error: null })
    } catch (error) { return next(error) }
  })

  app.post('/api/admin/players/:playerId/coin-grants', authenticate, requireAdmin, async (req, res, next) => {
    const playerId = Number(req.params.playerId)
    const operationId = String(req.body?.operationId || '')
    if (!Number.isInteger(playerId) || playerId < 1) return apiError(res, 422, 'INVALID_PLAYER_ID', '无效玩家')
    if (!operationId || operationId.length > 64) return apiError(res, 422, 'INVALID_OPERATION_ID', '操作编号无效')
    try {
      const updated = await db.transaction(async (transaction) => {
        const [player] = await transaction.query('SELECT id, username, coins FROM users WHERE id = ? AND role = \'player\' AND is_disabled = 0 FOR UPDATE', [playerId])
        if (!player) throw requestError(404, 'PLAYER_NOT_FOUND', '玩家不存在或已被禁用')
        const [existing] = await transaction.query('SELECT balance_after AS coins FROM wallet_ledger WHERE user_id = ? AND reference_type = \'admin_grant\' AND reference_id = ? FOR UPDATE', [playerId, operationId])
        if (existing) return { id: player.id, username: player.username, coins: Number(existing.coins), duplicate: true }
        const coins = Number(player.coins) + 1000
        await transaction.execute('UPDATE users SET coins = ? WHERE id = ?', [coins, playerId])
        await transaction.execute('INSERT INTO wallet_ledger (user_id, transaction_type, reference_type, reference_id, coins_delta, balance_after) VALUES (?, \'admin_grant\', \'admin_grant\', ?, 1000, ?)', [playerId, operationId, coins])
        await transaction.execute('INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, \'grant_player_coins\', \'player\', ?, ?)', [req.auth.sub, String(playerId), JSON.stringify({ operationId, coins: 1000 })])
        return { id: player.id, username: player.username, coins, duplicate: false }
      })
      realtime.publish(playerId, 'player-state', await readPlayerState(db, playerId))
      return res.status(201).json({ data: updated, error: null })
    } catch (error) { return next(error) }
  })

  app.post('/api/admin/notifications', authenticate, requireAdmin, async (req, res, next) => {
    try {
      const message = await publishNotification(db, { adminId: Number(req.auth.sub), title: req.body?.title, body: req.body?.body, recipientIds: req.body?.recipientIds ?? null })
      for (const playerId of req.body?.recipientIds || []) realtime.publish(playerId, 'notifications-updated', { notificationId: message.id })
      return res.status(201).json({ data: message, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/admin/notifications', authenticate, requireAdmin, async (_req, res, next) => {
    try {
      const messages = await db.query(`SELECT m.id, m.title, m.body AS content, m.audience, m.created_at AS sentAt,
        COUNT(r.user_id) AS recipientCount, SUM(r.read_at IS NOT NULL) AS readCount
        FROM notification_messages m LEFT JOIN notification_recipients r ON r.notification_id = m.id
        GROUP BY m.id ORDER BY m.created_at DESC, m.id DESC`)
      return res.json({ data: messages.map((message) => ({ ...message, audienceLabel: message.audience === 'all' ? '全体玩家' : `指定玩家（${message.recipientCount}）`, recipientCount: Number(message.recipientCount), readCount: Number(message.readCount || 0), status: 'sent' })), error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/admin/recharge-products', authenticate, requireAdmin, async (_req, res, next) => {
    try {
      const products = await db.query('SELECT id, display_name AS displayName, description, price_cents AS priceCents, benefits, qr_code_url AS qrCodeUrl, enabled, display_order AS displayOrder FROM recharge_products ORDER BY display_order, id')
      return res.json({ data: products.map(presentRechargeProduct), error: null })
    } catch (error) { return next(error) }
  })

  app.post('/api/admin/recharge-products', authenticate, requireAdmin, async (req, res, next) => {
    try {
      const displayName = String(req.body?.displayName || '').trim()
      const description = String(req.body?.description || '').trim()
      const priceCents = Number(req.body?.priceCents)
      const qrCodeUrl = String(req.body?.qrCodeUrl || '').trim()
      const benefits = parseRechargeBenefits(req.body?.benefits)
      const enabled = req.body?.enabled !== false
      const displayOrder = Math.round(Number(req.body?.displayOrder) || 0)
      if (!displayName || !description || !Number.isInteger(priceCents) || priceCents < 1 || !benefits || (enabled && !qrCodeUrl)) return apiError(res, 422, 'INVALID_RECHARGE_PRODUCT', '充值商品信息无效')
      const result = await db.transaction(async (transaction) => {
        const created = await transaction.execute('INSERT INTO recharge_products (display_name, description, price_cents, benefits, qr_code_url, enabled, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)', [displayName, description, priceCents, JSON.stringify(benefits), qrCodeUrl || null, enabled ? 1 : 0, displayOrder])
        await transaction.execute(`INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, 'create_recharge_product', 'recharge_product', ?, ?)` , [req.auth.sub, String(created.insertId), JSON.stringify({ displayName, priceCents })])
        const [product] = await transaction.query('SELECT id, display_name AS displayName, description, price_cents AS priceCents, benefits, qr_code_url AS qrCodeUrl, enabled, display_order AS displayOrder FROM recharge_products WHERE id = ?', [created.insertId])
        return presentRechargeProduct(product)
      })
      return res.status(201).json({ data: result, error: null })
    } catch (error) { return next(error) }
  })

  app.patch('/api/admin/recharge-products/:productId', authenticate, requireAdmin, async (req, res, next) => {
    const productId = Number(req.params.productId)
    const displayName = String(req.body?.displayName || '').trim()
    const description = String(req.body?.description || '').trim()
    const priceCents = Number(req.body?.priceCents)
    const qrCodeUrl = String(req.body?.qrCodeUrl || '').trim()
    const benefits = parseRechargeBenefits(req.body?.benefits)
    const enabled = req.body?.enabled !== false
    const displayOrder = Math.round(Number(req.body?.displayOrder) || 0)
    if (!Number.isInteger(productId) || productId < 1 || !displayName || !description || !Number.isInteger(priceCents) || priceCents < 1 || !benefits || (enabled && !qrCodeUrl)) return apiError(res, 422, 'INVALID_RECHARGE_PRODUCT', '充值商品信息无效')
    try {
      const result = await db.transaction(async (transaction) => {
        const updated = await transaction.execute('UPDATE recharge_products SET display_name = ?, description = ?, price_cents = ?, benefits = ?, qr_code_url = ?, enabled = ?, display_order = ? WHERE id = ?', [displayName, description, priceCents, JSON.stringify(benefits), qrCodeUrl || null, enabled ? 1 : 0, displayOrder, productId])
        if (!updated.affectedRows) throw requestError(404, 'RECHARGE_PRODUCT_NOT_FOUND', '充值商品不存在')
        await transaction.execute('INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, \'update_recharge_product\', \'recharge_product\', ?, ?)', [req.auth.sub, String(productId), JSON.stringify({ displayName, priceCents, enabled })])
        const [product] = await transaction.query('SELECT id, display_name AS displayName, description, price_cents AS priceCents, benefits, qr_code_url AS qrCodeUrl, enabled, display_order AS displayOrder FROM recharge_products WHERE id = ?', [productId])
        return presentRechargeProduct(product)
      })
      return res.json({ data: result, error: null })
    } catch (error) { return next(error) }
  })

  app.get('/api/events', authenticate, async (req, res) => {
    res.status(200).set({ 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'Content-Type': 'text/event-stream' })
    res.flushHeaders()
    res.write(`event: player-state\ndata: ${JSON.stringify(await readPlayerState(db, req.auth.sub))}\n\n`)
    const unsubscribe = realtime.subscribe(req.auth.sub, res)
    req.on('close', unsubscribe)
  })

  app.post('/api/game/settlements', authenticate, async (req, res) => {
    const { mode, levelNumber, fruitHits, hitRate, elapsedSeconds } = req.body || {}
    if (!['normal', 'hard', 'endless'].includes(mode)) return apiError(res, 422, 'INVALID_MODE', '无效的游戏模式')
    if (mode !== 'endless' && (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > 10)) return apiError(res, 422, 'INVALID_LEVEL', '无效的关卡')
    let settlement
    try { settlement = calculateSettlement({ mode, levelNumber, fruitHits, hitRate, elapsedSeconds }) } catch { return apiError(res, 422, 'INVALID_SETTLEMENT', '无法计算本局结算') }

    let actualCoinsAwarded = settlement.coinsAwarded
    try {
      await db.transaction(async (transaction) => {
        const [player] = await transaction.query('SELECT coins, is_tester AS isTester FROM users WHERE id = ? FOR UPDATE', [req.auth.sub])
        if (!player) throw requestError(404, 'PLAYER_NOT_FOUND', '玩家不存在')
        if (mode !== 'endless') {
          const [progress] = await transaction.query('SELECT unlocked FROM level_progress WHERE user_id = ? AND mode = ? AND level_number = ? FOR UPDATE', [req.auth.sub, mode, levelNumber])
          if (!player.isTester && !progress?.unlocked) throw requestError(403, 'LEVEL_LOCKED', '该关卡尚未解锁')
        }
        const attempt = await transaction.execute('INSERT INTO game_attempts (user_id, mode, level_number, base_score, final_score, hit_rate, elapsed_seconds, passed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [req.auth.sub, mode, mode === 'endless' ? null : levelNumber, settlement.baseScore, settlement.finalScore, settlement.hitRate, settlement.elapsedSeconds, settlement.passed ? 1 : 0])
        const [coinBoost] = await transaction.query("SELECT expires_at AS expiresAt FROM player_effects WHERE user_id = ? AND effect_key = 'coin-boost' AND expires_at > CURRENT_TIMESTAMP FOR UPDATE", [req.auth.sub])
        const coinsAwarded = coinBoost ? Math.round(settlement.coinsAwarded * 1.5) : settlement.coinsAwarded
        actualCoinsAwarded = coinsAwarded
        if (coinsAwarded > 0) {
          const nextCoins = Number(player.coins) + coinsAwarded
          await transaction.execute('UPDATE users SET coins = ? WHERE id = ?', [nextCoins, req.auth.sub])
          await transaction.execute(`
            INSERT INTO wallet_ledger (user_id, transaction_type, reference_type, reference_id, coins_delta, balance_after)
            VALUES (?, 'game_reward', 'game_attempt', ?, ?, ?)
          `, [req.auth.sub, String(attempt.insertId), coinsAwarded, nextCoins])
        }
        if (mode !== 'endless') {
          await transaction.execute('UPDATE level_progress SET best_score = GREATEST(best_score, ?), completed_at = IF(?, COALESCE(completed_at, CURRENT_TIMESTAMP), completed_at) WHERE user_id = ? AND mode = ? AND level_number = ?', [settlement.finalScore, settlement.passed ? 1 : 0, req.auth.sub, mode, levelNumber])
          if (settlement.passed && levelNumber < 10) await transaction.execute('UPDATE level_progress SET unlocked = 1 WHERE user_id = ? AND mode = ? AND level_number = ?', [req.auth.sub, mode, levelNumber + 1])
        }
      })
    } catch (error) {
      if (error.code && error.status) return apiError(res, error.status, error.code, error.message)
      throw error
    }
    const state = await readPlayerState(db, req.auth.sub)
    realtime.publish(req.auth.sub, 'player-state', state)
    realtime.publishAll('leaderboards', await readLeaderboards(db))
    const responseSettlement = { ...settlement, coinsAwarded: Number(actualCoinsAwarded) }
    return res.status(201).json({ data: responseSettlement, error: null })
  })

  app.use((error, _req, res, _next) => {
    console.error(error)
    if (error.status && error.code) return apiError(res, error.status, error.code, error.message)
    apiError(res, 500, 'INTERNAL_ERROR', '服务器内部错误')
  })

  return { app, db, close: async () => { realtime.close(); await db.destroy() } }
}
