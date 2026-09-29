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
    const product = await instances.at(-1).db.execute(
      'INSERT INTO recharge_products (display_name, description, price_cents, benefits, qr_code_url) VALUES (?, ?, ?, ?, ?)',
      ['真实营收商品', '仅用于营收聚合测试', 100, JSON.stringify({ coins: 1000 }), 'https://example.test/qr.png'],
    )
    await instances.at(-1).db.execute(
      "INSERT INTO recharge_orders (order_no, user_id, product_id, status, qr_code_url, expires_at, paid_at) VALUES (?, ?, ?, 'paid', ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE), CURRENT_TIMESTAMP)",
      ['00000000-0000-4000-8000-000000000001', player.id, product.insertId, 'https://example.test/qr.png'],
    )

    const response = await client.get('/api/admin/revenue?startDate=2026-09-01&endDate=2026-09-30&aggregation=day').set('Authorization', `Bearer ${token}`)

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
    const settlement = await client.post('/api/game/settlements').set('Authorization', `Bearer ${token}`).send({
      mode: 'normal',
      levelNumber: 1,
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

  it('serializes simultaneous settlements so one level cannot skip progression', async () => {
    const login = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = login.body.data.token
    const requestSettlement = () => client.post('/api/game/settlements').set('Authorization', `Bearer ${token}`).send({
      mode: 'normal', levelNumber: 1, fruitHits: Array.from({ length: 20 }, (_, index) => ({ fruit: 'kiwi', combo: index + 1 })), hitRate: 0.82, elapsedSeconds: 20,
    })

    const [first, second] = await Promise.all([requestSettlement(), requestSettlement()])
    const state = await client.get('/api/me/state').set('Authorization', `Bearer ${token}`)

    expect([first.status, second.status]).toEqual([201, 201])
    expect(state.body.data.progress.normal.highestUnlockedLevel).toBe(2)
  })

  it('does not let a standard player settle a locked level directly', async () => {
    const login = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const response = await client.post('/api/game/settlements').set('Authorization', `Bearer ${login.body.data.token}`).send({
      mode: 'normal', levelNumber: 2, fruitHits: Array(10).fill({ fruit: 'watermelon' }), hitRate: 0.82, elapsedSeconds: 20,
    })

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

  it('returns recovered energy from the persisted recovery timer', async () => {
    const player = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = player.body.data.token
    await instances.at(-1).db.execute("UPDATE users SET energy = 4, energy_recovery_started_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE) WHERE username = '水果达人'")

    const state = await client.get('/api/me/state').set('Authorization', `Bearer ${token}`)

    expect(state.body.data.wallet.energy).toBe(5)
    expect(state.body.data.wallet.energyRecoveryStartedAt).toBeNull()
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
