// 每一项同时描述“要求玩家做到多少”和“游戏怎样制造操作压力”。
// 使用显式十关配置比隐藏在公式中的魔法数字更方便后台后续调参和版本化。
const NORMAL_LEVELS = [
  { hitRate: 0.42, baseSpeed: 0.92, smallFruitRatio: 0.00, bombEvery: 6, extraFruitEvery: 0 },
  { hitRate: 0.46, baseSpeed: 0.96, smallFruitRatio: 0.04, bombEvery: 6, extraFruitEvery: 0 },
  { hitRate: 0.50, baseSpeed: 1.00, smallFruitRatio: 0.08, bombEvery: 7, extraFruitEvery: 0 },
  { hitRate: 0.54, baseSpeed: 1.04, smallFruitRatio: 0.12, bombEvery: 7, extraFruitEvery: 0 },
  { hitRate: 0.57, baseSpeed: 1.08, smallFruitRatio: 0.16, bombEvery: 6, extraFruitEvery: 0 },
  { hitRate: 0.60, baseSpeed: 1.12, smallFruitRatio: 0.22, bombEvery: 6, extraFruitEvery: 18 },
  { hitRate: 0.63, baseSpeed: 1.16, smallFruitRatio: 0.28, bombEvery: 5, extraFruitEvery: 16 },
  { hitRate: 0.66, baseSpeed: 1.19, smallFruitRatio: 0.34, bombEvery: 5, extraFruitEvery: 14 },
  { hitRate: 0.69, baseSpeed: 1.22, smallFruitRatio: 0.40, bombEvery: 4, extraFruitEvery: 12 },
  { hitRate: 0.70, baseSpeed: 1.25, smallFruitRatio: 0.46, bombEvery: 4, extraFruitEvery: 10 },
]

const HARD_LEVELS = [
  { hitRate: 0.58, baseSpeed: 1.06, smallFruitRatio: 0.22, bombEvery: 6, extraFruitEvery: 0 },
  { hitRate: 0.61, baseSpeed: 1.10, smallFruitRatio: 0.28, bombEvery: 5, extraFruitEvery: 0 },
  { hitRate: 0.64, baseSpeed: 1.14, smallFruitRatio: 0.34, bombEvery: 5, extraFruitEvery: 16 },
  { hitRate: 0.67, baseSpeed: 1.19, smallFruitRatio: 0.40, bombEvery: 4, extraFruitEvery: 14 },
  { hitRate: 0.70, baseSpeed: 1.24, smallFruitRatio: 0.46, bombEvery: 4, extraFruitEvery: 12 },
  { hitRate: 0.73, baseSpeed: 1.29, smallFruitRatio: 0.52, bombEvery: 3, extraFruitEvery: 10 },
  { hitRate: 0.76, baseSpeed: 1.34, smallFruitRatio: 0.58, bombEvery: 3, extraFruitEvery: 9 },
  { hitRate: 0.79, baseSpeed: 1.39, smallFruitRatio: 0.64, bombEvery: 3, extraFruitEvery: 8 },
  { hitRate: 0.81, baseSpeed: 1.44, smallFruitRatio: 0.70, bombEvery: 2, extraFruitEvery: 7 },
  { hitRate: 0.82, baseSpeed: 1.48, smallFruitRatio: 0.74, bombEvery: 2, extraFruitEvery: 6 },
]

const ENDLESS_BASE = Object.freeze({
  hitRate: 0,
  baseSpeed: 1.12,
  smallFruitRatio: 0.35,
  bombEvery: 5,
  extraFruitEvery: 0,
})

function freezeProfiles(profiles) {
  return Object.freeze(profiles.map((profile) => Object.freeze(profile)))
}

export const NORMAL_LEVEL_BALANCE = freezeProfiles(NORMAL_LEVELS)
export const HARD_LEVEL_BALANCE = freezeProfiles(HARD_LEVELS)

function levelIndex(level) {
  const number = Math.max(1, Math.min(10, Math.trunc(Number(level) || 1)))
  return number - 1
}

export function levelBalanceFor(level = 1, mode = 'normal') {
  if (mode === 'endless') return ENDLESS_BASE
  return (mode === 'hard' ? HARD_LEVEL_BALANCE : NORMAL_LEVEL_BALANCE)[levelIndex(level)]
}

export function requiredHitRate(level = 1, mode = 'normal') {
  return levelBalanceFor(level, mode).hitRate
}

// 该指数只用于比较和测试，不直接参与物理计算。权重覆盖五种可感知压力。
export function difficultyIndexFor(level = 1, mode = 'normal') {
  const profile = levelBalanceFor(level, mode)
  const extraPressure = profile.extraFruitEvery ? (15 - profile.extraFruitEvery) * 2 : 0
  return Math.round((
    profile.baseSpeed * 100
    + profile.smallFruitRatio * 100
    + (7 - profile.bombEvery) * 10
    + extraPressure
    + profile.hitRate * 100
  ) * 10) / 10
}

export function difficultyCoefficientFor(level = 1, mode = 'normal') {
  const profile = levelBalanceFor(level, mode)
  const speedPressure = Math.max(0, (profile.baseSpeed - 0.92) / 0.56)
  const sizePressure = profile.smallFruitRatio / 0.74
  const bombPressure = Math.max(0, Math.min(1, (8 - profile.bombEvery) / 6))
  const extraPressure = profile.extraFruitEvery ? Math.max(0, Math.min(1, (20 - profile.extraFruitEvery) / 15)) : 0
  const hitPressure = Math.max(0, Math.min(1, (profile.hitRate - 0.42) / 0.40))
  const weightedPressure = speedPressure * 0.35 + sizePressure * 0.25 + bombPressure * 0.20 + extraPressure * 0.10 + hitPressure * 0.10
  const modeBase = mode === 'hard' ? 1.55 : mode === 'endless' ? 1.15 : 1
  const modeScale = mode === 'hard' ? 0.75 : 0.90
  return Math.round((modeBase + weightedPressure * modeScale) * 100) / 100
}
