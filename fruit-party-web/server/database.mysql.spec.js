import { afterAll, describe, expect, it } from 'vitest'
import { createDatabase, seedDatabase } from './database.js'
import { hashPassword } from './auth.js'

const testDatabaseName = `fruit_party_test_${process.pid}`
let database

afterAll(async () => {
  await database?.destroy()
})

describe('MySQL persistence', () => {
  it('creates and seeds an isolated MySQL database through the pooled data layer', async () => {
    database = await createDatabase({
      databaseName: testDatabaseName,
      config: {
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: process.env.MYSQL_PASSWORD,
      },
    })
    await seedDatabase(database, hashPassword)

    const users = await database.query('SELECT username FROM users WHERE username IN (?, ?)', ['tester', 'admin'])
    const tables = await database.query('SHOW TABLES')
    const tableNames = tables.map((table) => Object.values(table)[0])

    expect(users.map((user) => user.username).sort()).toEqual(['admin', 'tester'])
    expect(tableNames).toEqual(expect.arrayContaining([
      'admin_audit_logs',
      'game_sessions',
      'item_catalog',
      'notification_messages',
      'notification_recipients',
      'player_inventory',
      'player_privileges',
      'recharge_orders',
      'recharge_products',
      'wallet_ledger',
    ]))
    expect(await database.query('SELECT item_key FROM item_catalog ORDER BY id')).toHaveLength(6)
    expect(await database.query('SELECT display_name FROM recharge_products ORDER BY id')).toHaveLength(2)
  })
})
