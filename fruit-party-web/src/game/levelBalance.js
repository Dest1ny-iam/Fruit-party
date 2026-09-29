// 每一项同时描述“要求玩家做到多少”和“游戏怎样制造操作压力”。
// 使用显式十关配置比隐藏在公式中的魔法数字更方便后台后续调参和版本化。
const NORMAL_LEVELS = [
  { hitRate: 0.50, baseSpeed: 1.00, smallFruitRatio: 0.05, bombEvery: 6, extraFruitEvery: 0 },
  { hitRate: 0.54, baseSpeed: 1.03, smallFruitRatio: 0.10, bombEvery: 6, extraFruitEvery: 0 },
  { hitRate: 0.58, baseSpeed: 1.06, smallFruitRatio: 0.15, bombEvery: 5, extraFruitEvery: 0 },
  { hitRate: 0.62, baseSpeed: 1.09, smallFruitRatio: 0.20, bombEvery: 5, extraFruitEvery: 0 },
  { hitRate: 0.65, baseSpeed: 1.12, smallFruitRatio: 0.26, bombEvery: 5, extraFruitEvery: 14 },
  { hitRate: 0.67, baseSpeed: 1.16, smallFruitRatio: 0.33, bombEvery: 4, extraFruitEvery: 12 },
  { hitRate: 0.69, baseSpeed: 1.20, smallFruitRatio: 0.40, bombEvery: 4, extraFruitEvery: 10 },
  { hitRate: 0.70, baseSpeed: 1.24, smallFruitRatio: 0.48, bombEvery: 4, extraFruitEvery: 9 },
  { hitRate: 0.70, baseSpeed: 1.28, smallFruitRatio: 0.56, bombEvery: 3, extraFruitEvery: 8 },
  { hitRate: 0.70, baseSpeed: 1.32, smallFruitRatio: 0.62, bombEvery: 3, extraFruitEvery: 7 },
]

const HARD_LEVELS = [
  { hitRate: 0.68, baseSpeed: 1.15, smallFruitRatio: 0.30, bombEvery: 5, extraFruitEvery: 0 },
  { hitRate: 0.71, baseSpeed: 1.19, smallFruitRatio: 0.36, bombEvery: 4, extraFruitEvery: 0 },
  { hitRate: 0.74, baseSpeed: 1.23, smallFruitRatio: 0.42, bombEvery: 4, extraFruitEvery: 12 },
  { hitRate: 0.76, baseSpeed: 1.27, smallFruitRatio: 0.48, bombEvery: 4, extraFruitEvery: 10 },
  { hitRate: 0.78, baseSpeed: 1.31, smallFruitRatio: 0.54, bombEvery: 3, extraFruitEvery: 9 },
  { hitRate: 0.79, baseSpeed: 1.35, smallFruitRatio: 0.60, bombEvery: 3, extraFruitEvery: 8 },
  { hitRate: 0.80, baseSpeed: 1.39, smallFruitRatio: 0.65, bombEvery: 3, extraFruitEvery: 7 },
  { hitRate: 0.81, baseSpeed: 1.43, smallFruitRatio: 0.70, bombEvery: 3, extraFruitEvery: 6 },
  { hitRate: 0.82, baseSpeed: 1.47, smallFruitRatio: 0.74, bombEvery: 2, extraFruitEvery: 6 },
  { hitRate: 0.82, baseSpeed: 1.50, smallFruitRatio: 0.78, bombEvery: 2, extraFruitEvery: 5 },
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
