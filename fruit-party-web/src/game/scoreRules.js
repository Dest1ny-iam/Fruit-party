// 连击倍率同时供实时游戏和关卡预算模拟使用，避免两套算法逐渐产生偏差。
export function comboMultiplier(combo = 0) {
  if (combo >= 10) return 1.6
  if (combo >= 7) return 1.4
  if (combo >= 4) return 1.25
  if (combo >= 2) return 1.1
  return 1
}

export function scoreForFruit(baseScore, combo = 1, scoreBoost = 1) {
  const base = Math.max(0, Number(baseScore) || 0)
  const boost = Math.max(0, Number(scoreBoost) || 0)
  return Math.round(base * comboMultiplier(combo) * boost)
}
