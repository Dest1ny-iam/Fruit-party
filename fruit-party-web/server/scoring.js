export const FRUIT_SCORES = Object.freeze({
  apple: 15,
  orange: 16,
  watermelon: 8,
  banana: 13,
  pineapple: 12,
  kiwi: 20,
  strawberry: 19,
  dragonfruit: 14,
  cantaloupe: 9,
  pear: 15,
})

// 目标分来自当前水果目录、关卡时长和命中率预算；达到配置命中率时可过关，完美局保留余量。
const NORMAL_TARGETS = [510, 640, 900, 1150, 2100, 2260, 2440, 2600, 2730, 2790]
const HARD_TARGETS = [1340, 1720, 2240, 2620, 3180, 3380, 3580, 3680, 3860, 3960]

export function levelTarget(mode, levelNumber) {
  const targets = mode === 'hard' ? HARD_TARGETS : NORMAL_TARGETS
  const target = targets[Number(levelNumber) - 1]
  if (!target) throw new Error('Invalid level number')
  return target
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function coinReward(mode, baseScore, hitRate, passed) {
  if (baseScore <= 0) return 0
  const ranges = {
    normal: passed ? [35, 80] : [10, 30],
    hard: passed ? [50, 110] : [15, 40],
    endless: [20, 120],
  }
  const [minimum, maximum] = ranges[mode] || ranges.normal
  return Math.round(minimum + (maximum - minimum) * clamp(hitRate, 0, 0.82) / 0.82)
}

export function calculateSettlement({ mode, levelNumber, fruitHits, hitRate, elapsedSeconds }) {
  const validHits = Array.isArray(fruitHits) ? fruitHits : []
  const baseScore = validHits.reduce((total, hit) => {
    const fruitScore = FRUIT_SCORES[hit?.fruit]
    if (!fruitScore) return total
    const combo = Math.min(10, Math.max(1, Math.trunc(Number(hit?.combo) || 1)))
    const scoreBoost = Number(hit?.scoreBoost) === 1.2 ? 1.2 : 1
    return total + scoreForFruit(fruitScore, combo, scoreBoost)
  }, 0)
  const cappedHitRate = clamp(Number(hitRate) || 0, 0, 0.82)
  const precisionRatio = cappedHitRate / 0.82
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0)
  const timeRatio = mode === 'endless' ? clamp(1 - Math.max(0, elapsed - 45) / 435, 0.4, 1) : 1
  const performanceScore = Math.round(baseScore * 0.5 * precisionRatio * timeRatio)
  const finalScore = baseScore + performanceScore
  const targetScore = mode === 'endless' ? null : levelTarget(mode, levelNumber)
  const passed = targetScore === null ? null : finalScore >= targetScore

  return {
    baseScore,
    performanceScore,
    finalScore,
    hitRate: cappedHitRate,
    elapsedSeconds: Math.round(elapsed),
    targetScore,
    passed,
    coinsAwarded: coinReward(mode, baseScore, cappedHitRate, passed),
  }
}
import { scoreForFruit } from '../src/game/scoreRules.js'
