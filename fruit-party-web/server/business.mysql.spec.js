import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { hashPassword } from './auth.js'
import { createDatabase, seedDatabase } from './database.js'
import { createRechargeOrder, grantPlayerPrivileges, listNotifications, markNotificationRead, publishNotification, removeNotification } from './business.js'

const databaseName = `fruit_party_test_business_${process.pid}`
let database
let adminId
let playerId
let productId

beforeAll(async () => {
  database = await createDatabase({ databaseName })
  await seedDatabase(database, hashPassword)
  ;[{ id: adminId }] = await database.query("SELECT id FROM users WHERE username = 'admin'")
  ;[{ id: playerId }] = await database.query("SELECT id FROM users WHERE username = '水果达人'")
  const product = await database.execute(`
    INSERT INTO recharge_products (display_name, description, price_cents, benefits, qr_code_url)
    VALUES (?, ?, ?, ?, ?)
  `, ['测试补给', '用于验证支付订单。', 100, JSON.stringify({ coins: 1000 }), 'https://example.test/pay-code.png'])
  productId = product.insertId
})

afterAll(async () => database?.destroy())

describe('MySQL player business services', () => {
  it('records a privilege grant and its administrator audit record atomically', async () => {
    const privilege = await grantPlayerPrivileges(database, {
      adminId,
      playerId,
      privileges: { infiniteEnergy: true, infiniteCoins: true, unlockAllLevels: true },
    })
    const [stored] = await database.query('SELECT infinite_energy, infinite_coins, unlock_all_levels, granted_by FROM player_privileges WHERE user_id = ?', [playerId])
    const audit = await database.query("SELECT action, target_id FROM admin_audit_logs WHERE action = 'grant_privileges' AND target_id = ?", [String(playerId)])

    expect(privilege).toEqual({ infiniteEnergy: true, infiniteCoins: true, unlockAllLevels: true })
    expect(stored).toMatchObject({ infinite_energy: 1, infinite_coins: 1, unlock_all_levels: 1, granted_by: adminId })
    expect(audit).toHaveLength(1)
  })

  it('publishes selected notifications and persists read/delete state per recipient', async () => {
    const message = await publishNotification(database, {
      adminId,
      title: '维护通知',
      body: '今晚短暂维护。',
      recipientIds: [playerId],
    })
    let notifications = await listNotifications(database, playerId)

    expect(message.audience).toBe('selected')
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({ title: '维护通知', read: false })

    await markNotificationRead(database, { userId: playerId, notificationId: message.id })
    notifications = await listNotifications(database, playerId)
    expect(notifications[0].read).toBe(true)

    await removeNotification(database, { userId: playerId, notificationId: message.id })
    expect(await listNotifications(database, playerId)).toEqual([])
  })

  it('creates a pending recharge order with a ten-minute expiry and distinct order number', async () => {
    const now = new Date('2026-09-28T12:00:00.000Z')
    const order = await createRechargeOrder(database, { userId: playerId, productId, now, orderNo: randomUUID() })

    expect(order).toMatchObject({ status: 'pending', productId, qrCodeUrl: 'https://example.test/pay-code.png' })
    expect(new Date(order.expiresAt).getTime() - now.getTime()).toBe(10 * 60 * 1000)
    const [stored] = await database.query('SELECT status FROM recharge_orders WHERE order_no = ?', [order.orderNo])
    expect(stored.status).toBe('pending')
  })
})
