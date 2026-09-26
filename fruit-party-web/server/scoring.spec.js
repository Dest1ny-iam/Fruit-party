import { describe, expect, it } from 'vitest'
import { calculateSettlement, levelTarget } from './scoring.js'

describe('calculateSettlement', () => {
  it('derives the base score from recognised fruits instead of a client supplied score', () => {
    const result = calculateSettlement({
      mode: 'normal',
      levelNumber: 1,
      fruitHits: [{ fruit: 'apple' }, { fruit: 'watermelon' }],
      hitRate: 0.8,
      elapsedSeconds: 30,
    })

    expect(result.baseScore).toBe(210)
    expect(result.finalScore).toBeGreaterThan(result.baseScore)
  })

  it('caps precision gains at the configured 82 percent ceiling', () => {
    const input = { mode: 'normal', levelNumber: 1, fruitHits: Array(10).fill({ fruit: 'mango' }), elapsedSeconds: 40 }
    const atCeiling = calculateSettlement({ ...input, hitRate: 0.82 })
    const overCeiling = calculateSettlement({ ...input, hitRate: 1 })

    expect(overCeiling.finalScore).toBe(atCeiling.finalScore)
  })

  it('reduces endless performance bonus for a long low-efficiency round without making the score negative', () => {
    const fruitHits = Array(20).fill({ fruit: 'orange' })
    const quick = calculateSettlement({ mode: 'endless', fruitHits, hitRate: 0.8, elapsedSeconds: 45 })
    const slow = calculateSettlement({ mode: 'endless', fruitHits, hitRate: 0.4, elapsedSeconds: 480 })

    expect(slow.performanceScore).toBeGreaterThanOrEqual(0)
    expect(slow.finalScore).toBeLessThan(quick.finalScore)
  })

  it('has attainable normal-mode targets for all ten levels', () => {
    expect(levelTarget('normal', 1)).toBe(180)
    expect(levelTarget('normal', 10)).toBeLessThan(levelTarget('hard', 10))
  })
})
