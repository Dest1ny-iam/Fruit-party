// 首关给 30 秒操作时间；后续关卡每关略微延长，配合更快水果和更多炸弹。
// 50 秒上限避免后期关卡无限拉长游戏时长。
export function roundSecondsForLevel(levelNumber = 1) {
  const number = Math.max(1, Number(levelNumber) || 1)
  return Math.min(30 + (number - 1) * 5, 50)
}
