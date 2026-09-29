import { describe, expect, it } from 'vitest'
import { CATALOG_ITEMS } from './database.js'

describe('item catalog', () => {
  it('keeps the six supported gameplay items', () => {
    expect(CATALOG_ITEMS.map(([key]) => key)).toEqual([
      'revive-card',
      'bomb-shield',
      'coin-boost',
      'time-plus',
      'score-boost',
      'energy-pack',
    ])
  })
})
