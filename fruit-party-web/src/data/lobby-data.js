// 大厅数据暂时使用假数据。接入后端时，只需要把这些导出值替换为接口返回的数据。

// 无尽模式按单局最高分排序，是排行榜默认展示的数据源。
export const endlessRankingPlayers = [
  { rank: 1, avatar: 'N', name: '水果达人', score: '98,420' },
  { rank: 2, avatar: 'L', name: '一刀两半', score: '86,100' },
  { rank: 3, avatar: 'M', name: '蜜瓜骑士', score: '75,680' },
  { rank: 4, avatar: 'S', name: '切切乐', score: '62,540' },
  { rank: 5, avatar: 'Y', name: '杨桃', score: '59,320' },
]

// 困难模式按已通关的关数排序，score 字段复用为页面要显示的排名指标。
export const hardRankingPlayers = [
  { rank: 1, avatar: 'K', name: '夜刃', score: '通关 5 关' },
  { rank: 2, avatar: 'R', name: '红柚', score: '通关 5 关' },
  { rank: 3, avatar: 'P', name: '石榴籽', score: '通关 4 关' },
  { rank: 4, avatar: 'G', name: '葡萄汽水', score: '通关 3 关' },
  { rank: 5, avatar: 'A', name: '青苹果', score: '通关 2 关' },
]
