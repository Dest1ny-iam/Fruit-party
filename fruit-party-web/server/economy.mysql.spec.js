import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth.js'
import { createDatabase, seedDatabase } from './database.js'
import { purchaseItem } from './economy.js'

const databaseName = `fruit_party_test_economy_${process.pid}`
let database
let userId
let itemId
let testerId

beforeAll(async () => {
  database = await createDatabase({ databaseName })
  await seedDatabase(database, hashPassword)
  const user = await database.execute('INSERT INTO users (username, password_hash, coins) VALUES (?, ?, ?)', ['商城测试员', hashPassword('Player123'), 500])
  userId = user.insertId
  const [tester] = await database.query('SELECT id FROM users WHERE username = ?', ['tester'])
  testerId = tester.id
  const item = await database.execute(`
    INSERT INTO item_catalog (item_key, display_name, description, price_coins, max_purchase_quantity)
    VALUES (?, ?, ?, ?, ?)
  `, ['revive_card', '复活卡', '失败后可继续本局挑战。', 100, 99])
  itemId = item.insertId
})

afterAll(async () => database?.destroy())

describe('MySQL economy transactions', () => {
  it('atomically deducts coins, records a ledger row, and increments inventory', async () => {
    const result = await purchaseItem(database, { userId, itemId, quantity: 3, requestId: 'purchase-001' })
    const [wallet] = await database.query('SELECT coins FROM users WHERE id = ?', [userId])
    const [inventory] = await database.query('SELECT quantity FROM player_inventory WHERE user_id = ? AND item_id = ?', [userId, itemId])
    const ledger = await database.query('SELECT coins_delta, balance_after FROM wallet_ledger WHERE user_id = ?', [userId])

    expect(result).toMatchObject({ chargedCoins: 300, quantity: 3, remainingCoins: 200 })
    expect(wallet.coins).toBe(200)
    expect(inventory.quantity).toBe(3)
    expect(ledger).toEqual([{ coins_delta: -300, balance_after: 200 }])
  })

  it('treats the same request id as an idempotent purchase', async () => {
    const replay = await purchaseItem(database, { userId, itemId, quantity: 3, requestId: 'purchase-001' })
    const [wallet] = await database.query('SELECT coins FROM users WHERE id = ?', [userId])
    const [inventory] = await database.query('SELECT quantity FROM player_inventory WHERE user_id = ? AND item_id = ?', [userId, itemId])

    expect(replay).toMatchObject({ chargedCoins: 300, quantity: 3, remainingCoins: 200, replayed: true })
    expect(wallet.coins).toBe(200)
    expect(inventory.quantity).toBe(3)
  })

  it('keeps an infinite-coin purchase idempotent without changing its balance', async () => {
    await database.execute('INSERT INTO player_privileges (user_id, infinite_coins) VALUES (?, 1)', [userId])

    const first = await purchaseItem(database, { userId, itemId, quantity: 2, requestId: 'purchase-infinite-001' })
    const replay = await purchaseItem(database, { userId, itemId, quantity: 2, requestId: 'purchase-infinite-001' })
    const [wallet] = await database.query('SELECT coins FROM users WHERE id = ?', [userId])
    const [inventory] = await database.query('SELECT quantity FROM player_inventory WHERE user_id = ? AND item_id = ?', [userId, itemId])

    expect(first).toMatchObject({ chargedCoins: 0, quantity: 2, remainingCoins: 200, replayed: false })
    expect(replay).toMatchObject({ chargedCoins: 0, quantity: 2, remainingCoins: 200, replayed: true })
    expect(wallet.coins).toBe(200)
    expect(inventory.quantity).toBe(5)
  })

  it('does not deduct coins while the tester switch is active', async () => {
    const purchase = await purchaseItem(database, { userId: testerId, itemId, quantity: 2, requestId: 'tester-purchase-001' })
    const [wallet] = await database.query('SELECT coins FROM users WHERE id = ?', [testerId])

    expect(purchase).toMatchObject({ chargedCoins: 0, quantity: 2, remainingCoins: 1000 })
    expect(wallet.coins).toBe(1000)
  })
})
