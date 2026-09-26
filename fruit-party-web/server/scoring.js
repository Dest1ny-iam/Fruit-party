export const FRUIT_SCORES = Object.freeze({
  watermelon: 130,
  apple: 80,
  orange: 90,
  kiwi: 105,
  mango: 120,
  lemon: 75,
})

const NORMAL_TARGETS = [180, 290, 420, 570, 740, 930, 1140, 1370, 1620, 1890]
const HARD_TARGETS = [260, 410, 590, 800, 1040, 1310, 1610, 1940, 2300, 2690]

export function levelTarget(mode, levelNumber) {
  const targets = mode === 'hard' ? HARD_TARGETS : NORMAL_TARGETS
  const target = targets[Number(levelNumber) - 1]
  if (!target) throw new Error('Invalid level number')
  return target
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function calculateSettlement({ mode, levelNumber, fruitHits, hitRate, elapsedSeconds }) {
  const validHits = Array.isArray(fruitHits) ? fruitHits : []
  const baseScore = validHits.reduce((total, hit) => total + (FRUIT_SCORES[hit?.fruit] || 0), 0)
  const cappedHitRate = clamp(Number(hitRate) || 0, 0, 0.82)
  const precisionRatio = cappedHitRate / 0.82
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0)
  const timeRatio = mode === 'endless' ? clamp(1 - Math.max(0, elapsed - 45) / 435, 0.4, 1) : 1
  const performanceScore = Math.round(baseScore * 0.5 * precisionRatio * timeRatio)
  const finalScore = baseScore + performanceScore
  const targetScore = mode === 'endless' ? null : levelTarget(mode, levelNumber)

  return {
    baseScore,
    performanceScore,
    finalScore,
    hitRate: cappedHitRate,
    elapsedSeconds: Math.round(elapsed),
    targetScore,
    passed: targetScore === null ? null : finalScore >= targetScore,
  }
}
