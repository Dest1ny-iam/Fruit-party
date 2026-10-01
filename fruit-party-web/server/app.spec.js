import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { beforeEach } from 'vitest'
import { createApp } from './app.js'

const instances = []
let client
let databaseSequence = 0

beforeEach(async () => {
  const instance = await createApp({ databaseName: `fruit_party_test_app_${process.pid}_${++databaseSequence}`, seed: true })
  instances.push(instance)
  client = request(instance.app)
})

afterEach(async () => {
  while (instances.length) await instances.pop().close()
})

describe('player API', () => {
  it('explains where to open the game when the API root is visited', async () => {
    const response = await client.get('/')

    expect(response.status).toBe(200)
    expect(response.type).toMatch(/html/)
    expect(response.text).toContain('水果切切乐')
    expect(response.text).toContain('http://127.0.0.1:5174')
  })

  it('exposes health without authentication', async () => {
    const response = await client.get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('ok')
  })

  it('seeds test and administrator accounts', async () => {
    const tester = await client.post('/api/auth/login').send({ username: 'tester', password: 'Tester123', acceptedTerms: true })
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })

    expect(tester.status).toBe(200)
    expect(tester.body.data.player.username).toBe('tester')
    expect(admin.status).toBe(200)
    expect(admin.body.data.player.role).toBe('admin')
  })

  it('requires agreement acceptance before login', async () => {
    const response = await client.post('/api/auth/login').send({ username: 'tester', password: 'Tester123', acceptedTerms: false })

    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe('TERMS_REQUIRED')
  })

  it('rate limits repeated login attempts from the same client', async () => {
    const instance = await createApp({
      databaseName: `fruit_party_test_app_rate_login_${process.pid}_${++databaseSequence}`,
      seed: true,
      rateLimitConfig: { login: { max: 2, windowMs: 60_000 } },
    })
    instances.push(instance)
    const limitedClient = request(instance.app)

    await limitedClient.post('/api/auth/login').send({ username: 'tester', password: 'wrong-password', acceptedTerms: true }).expect(401)
    await limitedClient.post('/api/auth/login').send({ username: 'tester', password: 'wrong-password', acceptedTerms: true }).expect(401)
    const blocked = await limitedClient.post('/api/auth/login').send({ username: 'tester', password: 'wrong-password', acceptedTerms: true })

    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('LOGIN_RATE_LIMITED')
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('rate limits repeated administrator write operations', async () => {
    const instance = await createApp({
      databaseName: `fruit_party_test_app_rate_admin_${process.pid}_${++databaseSequence}`,
      seed: true,
      rateLimitConfig: { adminWrite: { max: 2, windowMs: 60_000 } },
    })
    instances.push(instance)
    const limitedClient = request(instance.app)
    const login = await limitedClient.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const token = login.body.data.token

    await limitedClient.patch('/api/admin/system/maintenance').set('Authorization', `Bearer ${token}`).send({ enabled: false }).expect(200)
    await limitedClient.patch('/api/admin/system/maintenance').set('Authorization', `Bearer ${token}`).send({ enabled: false }).expect(200)
    const blocked = await limitedClient.patch('/api/admin/system/maintenance').set('Authorization', `Bearer ${token}`).send({ enabled: false })

    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('ADMIN_RATE_LIMITED')
  })

  it('rejects player state access without a token', async () => {
    const response = await client.get('/api/me/state')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('AUTH_REQUIRED')
  })

  it('rejects an already named account with a displayable conflict code', async () => {
    const response = await client.post('/api/auth/register').send({
      username: 'tester', password: 'Player123', acceptedTerms: true,
    })

    expect(response.status).toBe(409)
    expect(response.body.error).toEqual({ code: 'USERNAME_TAKEN', message: '用户名已被注册，请重新取名' })
  })

  it('returns persisted player state after login', async () => {
    const login = await client.post('/api/auth/login').send({ username: 'tester', password: 'Tester123', acceptedTerms: true })
    const response = await client.get('/api/me/state').set('Authorization', `Bearer ${login.body.data.token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.player.username).toBe('tester')
    expect(response.body.data.progress.normal.highestUnlockedLevel).toBe(10)
    expect(response.body.data.wallet.coins).toBeGreaterThan(0)
  })

  it('persists a player avatar update in MySQL and returns it in player state', async () => {
    const login = await client.post('/api/auth/login').send({ username: 'tester', password: 'Tester123', acceptedTerms: true })
    const token = login.body.data.token

    const updated = await client.patch('/api/me/profile').set('Authorization', `Bearer ${token}`).send({ avatarUrl: '🍊' })
    const state = await client.get('/api/me/state').set('Authorization', `Bearer ${token}`)

    expect(updated.status).toBe(200)
    expect(updated.body.data.player.avatarUrl).toBe('🍊')
    expect(state.body.data.player.avatarUrl).toBe('🍊')
  })

  it('persists the tester switch and exposes its effective test privileges', async () => {
    const login = await client.post('/api/auth/login').send({ username: 'tester', password: 'Tester123', acceptedTerms: true })
    const token = login.body.data.token

    const initial = await client.get('/api/me/state').set('Authorization', `Bearer ${token}`)
    expect(initial.body.data.player).toMatchObject({ isTester: true, testingModeEnabled: true })
    expect(initial.body.data.privileges).toEqual({ infiniteEnergy: true, infiniteCoins: true, unlockAllLevels: true })

    const disabled = await client.patch('/api/me/testing-mode').set('Authorization', `Bearer ${token}`).send({ enabled: false })
    const afterDisable = await client.get('/api/me/state').set('Authorization', `Bearer ${token}`)

    expect(disabled.status).toBe(200)
    expect(afterDisable.body.data.player.testingModeEnabled).toBe(false)
    expect(afterDisable.body.data.privileges).toEqual({ infiniteEnergy: false, infiniteCoins: false, unlockAllLevels: false })
  })

  it('returns leaderboard entries generated from seeded database attempts', async () => {
    const response = await client.get('/api/leaderboards')

    expect(response.status).toBe(200)
    expect(response.body.data.endless).toHaveLength(5)
    expect(response.body.data.endless[0]).toMatchObject({ name: '水果达人', score: expect.any(Number) })
    expect(response.body.data.hard[0]).toMatchObject({ name: '水果达人', score: '通关 5 关' })
  })

  it('removes a disabled player from leaderboard and administrator permission candidates', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const players = await client.get('/api/admin/players').set('Authorization', `Bearer ${admin.body.data.token}`)
    const target = players.body.data.find((player) => player.username === '水果达人')

    const disabled = await client.patch(`/api/admin/players/${target.id}/status`)
      .set('Authorization', `Bearer ${admin.body.data.token}`).send({ disabled: true })
    const leaderboard = await client.get('/api/leaderboards')
    const remainingCandidates = await client.get('/api/admin/permissions').set('Authorization', `Bearer ${admin.body.data.token}`)

    expect(disabled.status).toBe(200)
    expect(leaderboard.body.data.endless.map((entry) => entry.name)).not.toContain('水果达人')
    expect(remainingCandidates.body.data.items.map((player) => player.username)).not.toContain('水果达人')
  })

  it('serves dashboard and catalog data from MySQL only to administrators', async () => {
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })

    const rejected = await client.get('/api/admin/dashboard').set('Authorization', `Bearer ${player.body.data.token}`)
    const dashboard = await client.get('/api/admin/dashboard').set('Authorization', `Bearer ${admin.body.data.token}`)
    const items = await client.get('/api/admin/items').set('Authorization', `Bearer ${admin.body.data.token}`)

    expect(rejected.status).toBe(403)
    expect(dashboard.status).toBe(200)
    expect(dashboard.body.data).toMatchObject({ totalPlayers: expect.any(Number), gameAttempts: expect.any(Number) })
    expect(items.status).toBe(200)
    expect(items.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ itemKey: 'revive-card', priceCoins: 600 })]))
  })

  it('persists administrator price updates instead of retaining a client-side catalog', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const token = admin.body.data.token
    const [item] = await client.get('/api/admin/items').set('Authorization', `Bearer ${token}`).then((response) => response.body.data.filter((entry) => entry.itemKey === 'revive-card'))

    const invalid = await client.patch(`/api/admin/items/${item.id}/price`).set('Authorization', `Bearer ${token}`).send({ priceCoins: -1 })
    const updated = await client.patch(`/api/admin/items/${item.id}/price`).set('Authorization', `Bearer ${token}`).send({ priceCoins: 480 })
    const items = await client.get('/api/admin/items').set('Authorization', `Bearer ${token}`)

    expect(invalid.status).toBe(422)
    expect(updated.status).toBe(200)
    expect(items.body.data.find((entry) => entry.id === item.id)).toMatchObject({ priceCoins: 480 })
  })

  it('supports paged item catalog queries and full administrator item CRUD', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const token = admin.body.data.token
    const page = await client.get('/api/admin/items?page=1&pageSize=2&keyword=复活').set('Authorization', `Bearer ${token}`)
    const created = await client.post('/api/admin/items').set('Authorization', `Bearer ${token}`).send({
      itemKey: 'combo-test-card', displayName: '连击卡', description: '测试道具。', icon: '◇', priceCoins: 88, maxPurchaseQuantity: 9, displayOrder: 20,
    })
    const updated = await client.patch(`/api/admin/items/${created.body.data.id}`).set('Authorization', `Bearer ${token}`).send({
      itemKey: 'combo-test-card', displayName: '高级连击卡', description: '更新后的道具。', icon: '◆', priceCoins: 99, maxPurchaseQuantity: 8, displayOrder: 2,
    })
    const disabled = await client.patch(`/api/admin/items/${created.body.data.id}/status`).set('Authorization', `Bearer ${token}`).send({ enabled: false })

    expect(page.body.data).toMatchObject({ page: 1, pageSize: 2, total: 1 })
    expect(created.status).toBe(201)
    expect(updated.body.data).toMatchObject({ displayName: '高级连击卡', priceCoins: 99, icon: '◆' })
    expect(disabled.body.data).toMatchObject({ enabled: false })
  })

  it('returns consistent pagination metadata for administrator players, notifications, and recharge products', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const token = admin.body.data.token
    const players = await client.get('/api/admin/players?page=1&pageSize=2').set('Authorization', `Bearer ${token}`)
    const notifications = await client.get('/api/admin/notifications?page=1&pageSize=2').set('Authorization', `Bearer ${token}`)
    const products = await client.get('/api/admin/recharge-products?page=1&pageSize=2').set('Authorization', `Bearer ${token}`)

    for (const response of [players, notifications, products]) {
      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ page: 1, pageSize: 2, total: expect.any(Number), items: expect.any(Array) })
      expect(response.body.data.items.length).toBeLessThanOrEqual(2)
    }
  })

  it('confirms a recharge order once and grants its database-defined benefits idempotently', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const adminToken = admin.body.data.token
    const playerToken = player.body.data.token
    const [before] = await instances.at(-1).db.query("SELECT id, coins FROM users WHERE username = '水果达人'")
    const product = await client.post('/api/admin/recharge-products').set('Authorization', `Bearer ${adminToken}`).send({
      displayName: '确认到账测试', description: '测试充值到账。', priceCents: 100, benefits: { benefitType: 'coins', benefitAmount: 1000 }, qrCodeUrl: 'https://example.test/qr.png',
    })
    const order = await client.post('/api/recharge-orders').set('Authorization', `Bearer ${playerToken}`).send({ productId: product.body.data.id })
    const confirmed = await client.post(`/api/admin/recharge-orders/${order.body.data.orderNo}/confirm`).set('Authorization', `Bearer ${adminToken}`).send({})
    const replay = await client.post(`/api/admin/recharge-orders/${order.body.data.orderNo}/confirm`).set('Authorization', `Bearer ${adminToken}`).send({})
    const stored = await client.get(`/api/recharge-orders/${order.body.data.orderNo}`).set('Authorization', `Bearer ${playerToken}`)
    const [after] = await instances.at(-1).db.query('SELECT coins FROM users WHERE id = ?', [before.id])

    expect(confirmed.status).toBe(200)
    expect(confirmed.body.data).toMatchObject({ status: 'paid', granted: true })
    expect(replay.status).toBe(200)
    expect(replay.body.data).toMatchObject({ status: 'paid', replayed: true })
    expect(stored.body.data.status).toBe('paid')
    expect(Number(after.coins) - Number(before.coins)).toBe(1000)
  })

  it('expires stale recharge orders on read and cancels pending orders idempotently', async () => {
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = player.body.data.token
    const product = await client.get('/api/recharge-products').set('Authorization', `Bearer ${token}`)
    const order = await client.post('/api/recharge-orders').set('Authorization', `Bearer ${token}`).send({ productId: product.body.data[0].id })
    await instances.at(-1).db.execute('UPDATE recharge_orders SET expires_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 MINUTE) WHERE order_no = ?', [order.body.data.orderNo])
    const expired = await client.get(`/api/recharge-orders/${order.body.data.orderNo}`).set('Authorization', `Bearer ${token}`)
    expect(expired.body.data.status).toBe('expired')

    const secondOrder = await client.post('/api/recharge-orders').set('Authorization', `Bearer ${token}`).send({ productId: product.body.data[0].id })
    const cancelled = await client.post(`/api/recharge-orders/${secondOrder.body.data.orderNo}/cancel`).set('Authorization', `Bearer ${token}`).send({})
    const replay = await client.post(`/api/recharge-orders/${secondOrder.body.data.orderNo}/cancel`).set('Authorization', `Bearer ${token}`).send({})
    const stored = await client.get(`/api/recharge-orders/${secondOrder.body.data.orderNo}`).set('Authorization', `Bearer ${token}`)

    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data).toMatchObject({ status: 'cancelled', replayed: false })
    expect(replay.body.data).toMatchObject({ status: 'cancelled', replayed: true })
    expect(stored.body.data.status).toBe('cancelled')
  })

  it('serves paged administrator audit records from MySQL without fixture rows', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const token = admin.body.data.token
    const [adminRecord] = await instances.at(-1).db.query("SELECT id FROM users WHERE username = 'admin'")
    await instances.at(-1).db.execute(
      "INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, 'update_item_price', 'item_catalog', '9', ?)",
      [adminRecord.id, JSON.stringify({ priceCoins: 480 })],
    )

    const response = await client.get('/api/admin/audit-logs?page=1&pageSize=5&type=admin').set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({ page: 1, pageSize: 5, total: expect.any(Number) })
    expect(response.body.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'admin', action: '调整道具价格' }),
    ]))
  })

  it('serves a selected player audit trail from MySQL without frontend templates', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const token = admin.body.data.token
    const [player] = await instances.at(-1).db.query("SELECT id FROM users WHERE username = '水果达人'")
    await instances.at(-1).db.execute(
      "INSERT INTO game_attempts (user_id, mode, level_number, base_score, final_score, hit_rate, elapsed_seconds, passed) VALUES (?, 'normal', 1, 100, 150, 0.8, 20, 1)",
      [player.id],
    )

    const response = await client.get(`/api/admin/players/${player.id}/audit-logs?page=1&pageSize=5&type=game`).set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'game', action: '普通模式第 1 关结算' }),
    ]))
  })

  it('aggregates paid recharge revenue from MySQL for the requested calendar range', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const token = admin.body.data.token
    const [player] = await instances.at(-1).db.query("SELECT id FROM users WHERE username = '水果达人'")
    const [clock] = await instances.at(-1).db.query("SELECT DATE_FORMAT(CURRENT_TIMESTAMP, '%Y-%m-%d') AS dateKey")
    const product = await instances.at(-1).db.execute(
      'INSERT INTO recharge_products (display_name, description, price_cents, benefits, qr_code_url) VALUES (?, ?, ?, ?, ?)',
      ['真实营收商品', '仅用于营收聚合测试', 100, JSON.stringify({ coins: 1000 }), 'https://example.test/qr.png'],
    )
    await instances.at(-1).db.execute(
      "INSERT INTO recharge_orders (order_no, user_id, product_id, status, qr_code_url, expires_at, paid_at) VALUES (?, ?, ?, 'paid', ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE), CURRENT_TIMESTAMP)",
      ['00000000-0000-4000-8000-000000000001', player.id, product.insertId, 'https://example.test/qr.png'],
    )

    const response = await client.get(`/api/admin/revenue?startDate=${clock.dateKey}&endDate=${clock.dateKey}&aggregation=day`).set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({ aggregation: 'day', totalRevenueCents: 100, paidOrderCount: 1 })
    expect(response.body.data.points.some((point) => point.valueCents === 100)).toBe(true)
  })

  it('rejects login from a disabled account', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const target = (await client.get('/api/admin/players').set('Authorization', `Bearer ${admin.body.data.token}`)).body.data
      .find((player) => player.username === '一刀两半')
    await client.patch(`/api/admin/players/${target.id}/status`).set('Authorization', `Bearer ${admin.body.data.token}`).send({ disabled: true })
    const login = await client.post('/api/auth/login').send({ username: '一刀两半', password: 'Player123', acceptedTerms: true })

    expect(login.status).toBe(403)
    expect(login.body.error.code).toBe('ACCOUNT_DISABLED')
  })

  it('settles a passed level on the server and unlocks only the next level', async () => {
    const login = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = login.body.data.token
    const entry = await client.post('/api/game/entries').set('Authorization', `Bearer ${token}`).send({ mode: 'normal', levelNumber: 1 })
    const settlement = await client.post('/api/game/settlements').set('Authorization', `Bearer ${token}`).send({
      sessionId: entry.body.data.sessionId,
      fruitHits: Array.from({ length: 20 }, (_, index) => ({ fruit: 'kiwi', combo: index + 1 })),
      hitRate: 0.82,
      elapsedSeconds: 25,
      clientFinalScore: 999999,
    })
    const state = await client.get('/api/me/state').set('Authorization', `Bearer ${token}`)

    expect(settlement.status).toBe(201)
    expect(settlement.body.data.finalScore).toBeLessThan(999999)
    expect(settlement.body.data.passed).toBe(true)
    expect(settlement.body.data.coinsAwarded).toBeGreaterThan(0)
    expect(state.body.data.wallet.coins).toBeGreaterThan(580)
    expect(state.body.data.progress.normal.highestUnlockedLevel).toBe(2)
  })

  it('binds settlement to one server game session and replays the first result idempotently', async () => {
    const login = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = login.body.data.token
    const entry = await client.post('/api/game/entries').set('Authorization', `Bearer ${token}`).send({ mode: 'normal', levelNumber: 1 })
    const payload = {
      sessionId: entry.body.data.sessionId,
      fruitHits: Array.from({ length: 20 }, (_, index) => ({ fruit: 'kiwi', combo: index + 1 })),
      hitRate: 0.82,
      elapsedSeconds: 25,
    }

    const first = await client.post('/api/game/settlements').set('Authorization', `Bearer ${token}`).send(payload)
    const replay = await client.post('/api/game/settlements').set('Authorization', `Bearer ${token}`).send(payload)
    const [attempts] = await instances.at(-1).db.query("SELECT COUNT(*) AS count FROM game_attempts WHERE mode = 'normal' AND user_id = (SELECT id FROM users WHERE username = ?)", ['水果达人'])

    expect(first.status).toBe(201)
    expect(replay.status).toBe(200)
    expect(replay.body.data).toMatchObject({ replayed: true, finalScore: first.body.data.finalScore })
    expect(Number(attempts.count)).toBe(1)
  })

  it('rejects settlement requests that do not include a server game session', async () => {
    const login = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const response = await client.post('/api/game/settlements').set('Authorization', `Bearer ${login.body.data.token}`).send({
      mode: 'normal', levelNumber: 1, fruitHits: [], hitRate: 0, elapsedSeconds: 10,
    })

    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe('SESSION_REQUIRED')
  })

  it('serializes simultaneous settlements so one level cannot skip progression', async () => {
    const login = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = login.body.data.token
    const entry = await client.post('/api/game/entries').set('Authorization', `Bearer ${token}`).send({ mode: 'normal', levelNumber: 1 })
    const requestSettlement = () => client.post('/api/game/settlements').set('Authorization', `Bearer ${token}`).send({
      sessionId: entry.body.data.sessionId, fruitHits: Array.from({ length: 20 }, (_, index) => ({ fruit: 'kiwi', combo: index + 1 })), hitRate: 0.82, elapsedSeconds: 20,
    })

    const [first, second] = await Promise.all([requestSettlement(), requestSettlement()])
    const state = await client.get('/api/me/state').set('Authorization', `Bearer ${token}`)

    expect([first.status, second.status].sort()).toEqual([200, 201])
    expect(state.body.data.progress.normal.highestUnlockedLevel).toBe(2)
  })

  it('keeps one settlement and one reward when 9 requests race for the same session', async () => {
    const login = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = login.body.data.token
    const entry = await client.post('/api/game/entries').set('Authorization', `Bearer ${token}`).send({ mode: 'normal', levelNumber: 1 })
    const payload = {
      sessionId: entry.body.data.sessionId,
      fruitHits: Array.from({ length: 20 }, (_, index) => ({ fruit: 'kiwi', combo: index + 1 })),
      hitRate: 0.82,
      elapsedSeconds: 20,
    }
    const responses = await Promise.all(Array.from({ length: 9 }, () => client.post('/api/game/settlements').set('Authorization', `Bearer ${token}`).send(payload)))
    const [player] = await instances.at(-1).db.query("SELECT id FROM users WHERE username = '水果达人'")
    const [attempts] = await instances.at(-1).db.query('SELECT COUNT(*) AS total FROM game_attempts WHERE user_id = ? AND mode = \'normal\'', [player.id])
    const [rewards] = await instances.at(-1).db.query("SELECT COUNT(*) AS total FROM wallet_ledger WHERE user_id = ? AND transaction_type = 'game_reward'", [player.id])

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1)
    expect(responses.every((response) => [200, 201].includes(response.status))).toBe(true)
    expect(Number(attempts.total)).toBe(1)
    expect(Number(rewards.total)).toBe(1)
  })

  it('does not let a standard player settle a locked level directly', async () => {
    const login = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const response = await client.post('/api/game/entries').set('Authorization', `Bearer ${login.body.data.token}`).send({ mode: 'normal', levelNumber: 2 })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('LEVEL_LOCKED')
  })

  it('deducts energy only when a standard player confirms a game entry', async () => {
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = player.body.data.token

    const first = await client.post('/api/game/entries').set('Authorization', `Bearer ${token}`).send({ mode: 'normal', levelNumber: 1 })
    const second = await client.post('/api/game/entries').set('Authorization', `Bearer ${token}`).send({ mode: 'normal', levelNumber: 1 })
    const tester = await client.post('/api/auth/login').send({ username: 'tester', password: 'Tester123', acceptedTerms: true })
    const testerEntry = await client.post('/api/game/entries').set('Authorization', `Bearer ${tester.body.data.token}`).send({ mode: 'normal', levelNumber: 10 })

    expect(first.status).toBe(201)
    expect(first.body.data).toMatchObject({ energy: 4, chargedEnergy: 1 })
    expect(first.body.data.energyRecoveryStartedAt).toBeTruthy()
    expect(second.body.data).toMatchObject({ energy: 3, chargedEnergy: 1, energyRecoveryStartedAt: first.body.data.energyRecoveryStartedAt })
    expect(testerEntry.status).toBe(201)
    expect(testerEntry.body.data).toMatchObject({ energy: 5, chargedEnergy: 0 })
  })

  it('authorizes endless item activation and revive uses on the server', async () => {
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = player.body.data.token
    const db = instances.at(-1).db
    const [user] = await db.query("SELECT id FROM users WHERE username = '水果达人'")
    const catalog = await db.query("SELECT id, item_key AS itemKey FROM item_catalog WHERE item_key IN ('bomb-shield', 'score-boost', 'revive-card')")
    for (const item of catalog) {
      const quantity = item.itemKey === 'revive-card' ? 3 : 1
      await db.execute('INSERT INTO player_inventory (user_id, item_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)', [user.id, item.id, quantity])
    }
    const entry = await client.post('/api/game/entries').set('Authorization', `Bearer ${token}`).send({ mode: 'endless', itemKeys: ['bomb-shield', 'score-boost'] })
    const sessionId = entry.body.data.sessionId

    const activated = await client.post(`/api/game/sessions/${sessionId}/items/bomb-shield/activate`).set('Authorization', `Bearer ${token}`).send({})
    const replayActivation = await client.post(`/api/game/sessions/${sessionId}/items/bomb-shield/activate`).set('Authorization', `Bearer ${token}`).send({})
    const firstRevive = await client.post(`/api/game/sessions/${sessionId}/revive`).set('Authorization', `Bearer ${token}`).send({})
    const secondRevive = await client.post(`/api/game/sessions/${sessionId}/revive`).set('Authorization', `Bearer ${token}`).send({})
    const thirdRevive = await client.post(`/api/game/sessions/${sessionId}/revive`).set('Authorization', `Bearer ${token}`).send({})
    const fourthRevive = await client.post(`/api/game/sessions/${sessionId}/revive`).set('Authorization', `Bearer ${token}`).send({})
    const [inventory] = await db.query('SELECT quantity FROM player_inventory WHERE user_id = ? AND item_id = ?', [user.id, catalog.find((item) => item.itemKey === 'revive-card').id])

    expect(entry.status).toBe(201)
    expect(activated.status).toBe(200)
    expect(activated.body.data).toMatchObject({ itemKey: 'bomb-shield', durationSeconds: 20, remainingUses: 0 })
    expect(replayActivation.status).toBe(409)
    expect(replayActivation.body.error.code).toBe('ITEM_ALREADY_USED')
    expect([firstRevive.status, secondRevive.status, thirdRevive.status]).toEqual([200, 200, 200])
    expect(fourthRevive.status).toBe(409)
    expect(fourthRevive.body.error.code).toBe('REVIVE_LIMIT_REACHED')
    expect(Number(inventory.quantity)).toBe(0)
  })

  it('rejects session item actions after settlement and from another player', async () => {
    const owner = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const other = await client.post('/api/auth/login').send({ username: '一刀两半', password: 'Player123', acceptedTerms: true })
    const ownerToken = owner.body.data.token
    const entry = await client.post('/api/game/entries').set('Authorization', `Bearer ${ownerToken}`).send({ mode: 'endless', itemKeys: [] })
    const sessionId = entry.body.data.sessionId
    const foreign = await client.post(`/api/game/sessions/${sessionId}/revive`).set('Authorization', `Bearer ${other.body.data.token}`).send({})
    const settled = await client.post('/api/game/settlements').set('Authorization', `Bearer ${ownerToken}`).send({ sessionId, fruitHits: [], hitRate: 0, elapsedSeconds: 3 })
    const after = await client.post(`/api/game/sessions/${sessionId}/revive`).set('Authorization', `Bearer ${ownerToken}`).send({})

    expect(foreign.status).toBe(403)
    expect(foreign.body.error.code).toBe('GAME_SESSION_FORBIDDEN')
    expect(settled.status).toBe(201)
    expect(after.status).toBe(409)
    expect(after.body.error.code).toBe('GAME_SESSION_CLOSED')
  })

  it('does not trust a client score boost flag outside the server-authorized effect window', async () => {
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = player.body.data.token
    const entry = await client.post('/api/game/entries').set('Authorization', `Bearer ${token}`).send({ mode: 'endless', itemKeys: [] })
    const settlement = await client.post('/api/game/settlements').set('Authorization', `Bearer ${token}`).send({
      sessionId: entry.body.data.sessionId,
      fruitHits: [{ fruit: 'apple', combo: 1, scoreBoost: 1.2 }],
      hitRate: 1,
      elapsedSeconds: 1,
    })

    expect(settlement.status).toBe(201)
    expect(settlement.body.data.baseScore).toBe(15)
  })

  it('limits normal and hard sessions to one server-authorized revive', async () => {
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = player.body.data.token
    const db = instances.at(-1).db
    const [user] = await db.query("SELECT id FROM users WHERE username = '水果达人'")
    const [item] = await db.query("SELECT id FROM item_catalog WHERE item_key = 'revive-card'")
    await db.execute('INSERT INTO player_inventory (user_id, item_id, quantity) VALUES (?, ?, 2) ON DUPLICATE KEY UPDATE quantity = 2', [user.id, item.id])
    const entry = await client.post('/api/game/entries').set('Authorization', `Bearer ${token}`).send({ mode: 'normal', levelNumber: 1, itemKeys: ['revive-card'] })
    const first = await client.post(`/api/game/sessions/${entry.body.data.sessionId}/revive`).set('Authorization', `Bearer ${token}`).send({})
    const second = await client.post(`/api/game/sessions/${entry.body.data.sessionId}/revive`).set('Authorization', `Bearer ${token}`).send({})

    expect(first.status).toBe(200)
    expect(first.body.data).toMatchObject({ allowedUses: 1, remainingUses: 0 })
    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('REVIVE_LIMIT_REACHED')
  })

  it('returns recovered energy from the persisted recovery timer', async () => {
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = player.body.data.token
    await instances.at(-1).db.execute("UPDATE users SET energy = 4, energy_recovery_started_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE) WHERE username = '水果达人'")

    const state = await client.get('/api/me/state').set('Authorization', `Bearer ${token}`)

    expect(state.body.data.wallet.energy).toBe(5)
    expect(state.body.data.wallet.energyRecoveryStartedAt).toBeNull()
  })

  it('returns a paged wallet ledger from MySQL for the profile page', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const [playerRow] = await instances.at(-1).db.query("SELECT id, coins FROM users WHERE username = '水果达人'")
    await instances.at(-1).db.execute(
      "INSERT INTO wallet_ledger (user_id, transaction_type, reference_type, reference_id, coins_delta, balance_after) VALUES (?, 'admin_grant', 'test', UUID(), 1000, ?)",
      [playerRow.id, Number(playerRow.coins) + 1000],
    )

    const response = await client.get('/api/me/wallet/ledger?page=1&pageSize=1').set('Authorization', `Bearer ${player.body.data.token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({ page: 1, pageSize: 1, total: 1 })
    expect(response.body.data.items[0]).toMatchObject({ amount: 1000, balanceAfter: Number(playerRow.coins) + 1000 })
    expect(admin.status).toBe(200)
  })

  it('persists remote maintenance mode and blocks new player sessions', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const adminToken = admin.body.data.token
    const playerToken = player.body.data.token

    const initial = await client.get('/api/system/status')
    const enabled = await client.patch('/api/admin/system/maintenance').set('Authorization', `Bearer ${adminToken}`).send({ enabled: true, message: '服务器升级中' })
    const publicStatus = await client.get('/api/system/status')
    const blocked = await client.post('/api/game/entries').set('Authorization', `Bearer ${playerToken}`).send({ mode: 'normal', levelNumber: 1 })
    const disabled = await client.patch('/api/admin/system/maintenance').set('Authorization', `Bearer ${adminToken}`).send({ enabled: false })

    expect(initial.body.data).toMatchObject({ enabled: false })
    expect(enabled.status).toBe(200)
    expect(publicStatus.body.data).toMatchObject({ enabled: true, message: '服务器升级中' })
    expect(blocked.status).toBe(503)
    expect(blocked.body.error.code).toBe('MAINTENANCE')
    expect(disabled.body.data.enabled).toBe(false)
  })

  it('blocks every player write during maintenance while testers retain test access', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const tester = await client.post('/api/auth/login').send({ username: 'tester', password: 'Tester123', acceptedTerms: true })
    const playerToken = player.body.data.token
    const session = await client.post('/api/game/entries').set('Authorization', `Bearer ${playerToken}`).send({ mode: 'normal', levelNumber: 1 })
    const products = await client.get('/api/recharge-products').set('Authorization', `Bearer ${playerToken}`)

    await client.patch('/api/admin/system/maintenance').set('Authorization', `Bearer ${admin.body.data.token}`).send({ enabled: true })
    const settlement = await client.post('/api/game/settlements').set('Authorization', `Bearer ${playerToken}`).send({ sessionId: session.body.data.sessionId, fruitHits: [], hitRate: 0, elapsedSeconds: 1 })
    const recharge = await client.post('/api/recharge-orders').set('Authorization', `Bearer ${playerToken}`).send({ productId: products.body.data[0].id })
    const testerEntry = await client.post('/api/game/entries').set('Authorization', `Bearer ${tester.body.data.token}`).send({ mode: 'normal', levelNumber: 1 })

    expect(settlement.body.error.code).toBe('MAINTENANCE')
    expect(recharge.body.error.code).toBe('MAINTENANCE')
    expect(testerEntry.status).toBe(201)
  })

  it('uses authenticated MySQL business APIs for privileges, inventory, notifications, and recharge orders', async () => {
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const adminToken = admin.body.data.token
    const playerToken = player.body.data.token
    const players = await client.get('/api/admin/players').set('Authorization', `Bearer ${adminToken}`)
    const target = players.body.data.find((candidate) => candidate.username === '水果达人')

    const granted = await client.patch(`/api/admin/players/${target.id}/privileges`).set('Authorization', `Bearer ${adminToken}`).send({
      adminPassword: 'Admin123', privileges: { infiniteEnergy: true, infiniteCoins: true, unlockAllLevels: true },
    })
    const item = await instances.at(-1).db.execute(`INSERT INTO item_catalog (item_key, display_name, description, price_coins) VALUES (?, ?, ?, ?)`, ['test-revive', '复活卡', '继续挑战。', 20])
    const purchased = await client.post('/api/shop/purchases').set('Authorization', `Bearer ${playerToken}`).send({ itemId: item.insertId, quantity: 2, requestId: 'api-purchase-001' })
    const inventory = await client.get('/api/me/inventory').set('Authorization', `Bearer ${playerToken}`)
    const published = await client.post('/api/admin/notifications').set('Authorization', `Bearer ${adminToken}`).send({ title: '联调通知', body: '真实数据。', recipientIds: [target.id] })
    const notifications = await client.get('/api/notifications').set('Authorization', `Bearer ${playerToken}`)
    const read = await client.patch(`/api/notifications/${published.body.data.id}/read`).set('Authorization', `Bearer ${playerToken}`)
    const recharge = await client.post('/api/admin/recharge-products').set('Authorization', `Bearer ${adminToken}`).send({
      displayName: '千枚金币', description: '测试充值卡。', priceCents: 100, benefits: { coins: 1000 }, qrCodeUrl: 'https://example.test/qr.png',
    })
    const order = await client.post('/api/recharge-orders').set('Authorization', `Bearer ${playerToken}`).send({ productId: recharge.body.data.id })

    expect(granted.status).toBe(200)
    expect(purchased.body.data).toMatchObject({ chargedCoins: 0, quantity: 2 })
    expect(inventory.body.data).toEqual([expect.objectContaining({ itemKey: 'test-revive', quantity: 2 })])
    expect(notifications.body.data).toEqual([expect.objectContaining({ title: '联调通知', read: false })])
    expect(read.status).toBe(204)
    expect(order.body.data).toMatchObject({ status: 'pending', qrCodeUrl: 'https://example.test/qr.png' })
  })
})
