import { describe, expect, it } from 'vitest'
import { difficultyCoefficientFor, levelBalanceFor } from './levelBalance'

describe('level balance', () => {
  it('starts normal mode with a forgiving hit-rate requirement and rises smoothly to 70 percent', () => {
    expect(levelBalanceFor(1, 'normal').hitRate).toBe(0.42)
    expect(levelBalanceFor(10, 'normal').hitRate).toBe(0.70)

    for (let level = 2; level <= 10; level += 1) {
      expect(levelBalanceFor(level, 'normal').hitRate).toBeGreaterThanOrEqual(levelBalanceFor(level - 1, 'normal').hitRate)
    }
  })

  it('keeps hard mode above the final normal level and caps its requirement at 82 percent', () => {
    expect(difficultyCoefficientFor(1, 'hard')).toBeGreaterThan(difficultyCoefficientFor(10, 'normal'))
    expect(levelBalanceFor(10, 'hard').hitRate).toBe(0.82)
  })
})
