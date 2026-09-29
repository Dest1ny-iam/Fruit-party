// 关卡数量和无尽解锁门槛集中配置，避免大厅、通知和路由各自写死数字。
export const MAX_LEVEL = 10
export const ENDLESS_UNLOCK_LEVEL = 5

export function isEndlessUnlocked(highestCompletedLevel = 0) {
  return Number(highestCompletedLevel) >= ENDLESS_UNLOCK_LEVEL
}

export function unlockedLevelAfterCompletion(highestCompletedLevel = 0, maximum = MAX_LEVEL) {
  const completed = Math.max(0, Number(highestCompletedLevel) || 0)
  const limit = Math.max(1, Number(maximum) || MAX_LEVEL)
  return Math.min(completed + 1, limit)
}
