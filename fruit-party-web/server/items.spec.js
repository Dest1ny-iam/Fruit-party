import { describe, expect, it } from 'vitest'
import { useInventoryItem } from './items.js'

function createFakeDatabase({ user = { id: 7, energy: 3, maxEnergy: 5, energyRecoveryStartedAt: null }, inventory = { itemKey: 'energy-pack', quantity: 2 } } = {}) {
  const calls = []
  return {
    calls,
    async transaction(work) {
      const transaction = {
        async query(sql) {
          calls.push(['query', sql])
          if (sql.includes('FROM users')) return [user]
          if (sql.includes('FROM player_inventory')) return [inventory]
          return []
        },
        async execute(sql, parameters) {
          calls.push(['execute', sql, parameters])
          return { affectedRows: 1 }
        },
      }
      return work(transaction)
    },
  }
}

describe('inventory item usage', () => {
  it('restores one energy and consumes one energy card atomically', async () => {
    const database = createFakeDatabase()
    const result = await useInventoryItem(database, { userId: 7, itemKey: 'energy-pack', now: new Date('2026-09-28T10:00:00Z') })

    expect(result).toMatchObject({ itemKey: 'energy-pack', quantity: 1, energy: 4, maxEnergy: 5 })
    expect(database.calls.some(([, sql]) => sql.includes('FOR UPDATE'))).toBe(true)
    expect(database.calls.some(([, sql]) => sql.includes('UPDATE users SET energy'))).toBe(true)
    expect(database.calls.some(([, sql]) => sql.includes('UPDATE player_inventory'))).toBe(true)
  })

  it('rejects an energy card when the wallet is already full', async () => {
    const database = createFakeDatabase({ user: { id: 7, energy: 5, maxEnergy: 5, energyRecoveryStartedAt: null } })

    await expect(useInventoryItem(database, { userId: 7, itemKey: 'energy-pack' })).rejects.toMatchObject({ code: 'ENERGY_FULL' })
  })
})
