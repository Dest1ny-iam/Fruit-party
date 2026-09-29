export const ITEM_CATALOG = Object.freeze([
  {
    id: 'revive-card', name: '复活卡', description: '死亡结算时获得一次继续机会', price: 600, icon: '↻', tone: 'gold', kind: 'revive',
    manual: {
      effect: '复活后保留本局分数和历史最佳连击，当前连击清零。',
      timing: '仅在死亡或闯关超时后的 5 秒确认期内使用。',
      limit: '每次固定消耗 1 张；库存不足时不能复活。',
      endless: '无尽模式继续当前波次和难度，单次挑战最多复活 3 次。',
    },
  },
  {
    id: 'bomb-shield', name: '去除 1/3 炸弹', description: '降低本局炸弹压力', price: 480, icon: '◈', tone: 'red', kind: 'bomb-shield',
    manual: {
      effect: '减少游戏过程中出现的炸弹。',
      timing: '普通和困难模式在进入游戏前选择并自动生效。',
      limit: '每局最多使用 1 张，困难模式仍保留最低炸弹数量。',
      endless: '带入后由玩家主动使用，20 秒内只保留约三分之一炸弹候选。',
    },
  },
  {
    id: 'coin-boost', name: '1.5 倍金币卡', description: '一段时间内提高结算金币', price: 900, icon: '₿', tone: 'violet', kind: 'timed',
    manual: {
      effect: '使用后 30 分钟内完成的对局，结算金币乘以 1.5。',
      timing: '购买后在背包主动使用，倒计时立即开始。',
      limit: '重复使用只延长持续时间，不叠加倍率。',
      endless: '无尽模式同样按对局结束时的有效状态计算金币。',
    },
  },
  {
    id: 'time-plus', name: '延时 10 秒', description: '限时关卡额外增加 10 秒', price: 700, icon: '＋', tone: 'blue', kind: 'consumable',
    manual: {
      effect: '进入游戏时立即把本局倒计时延长 10 秒。',
      timing: '在普通或困难模式进入游戏前选择。',
      limit: '每局最多使用 1 张。',
      endless: '无尽模式没有时间限制，因此不可携带。',
    },
  },
  {
    id: 'score-boost', name: '分数 ×1.2', description: '提高切中水果获得的分数', price: 850, icon: '×', tone: 'green', kind: 'consumable',
    manual: {
      effect: '水果基础分和连击奖励计算后再乘以 1.2。',
      timing: '普通和困难模式在进入游戏前选择并自动生效。',
      limit: '每局最多使用 1 张，不与同类倍率重复叠加。',
      endless: '带入后由玩家主动使用，20 秒内新获得的水果分数乘以 1.2。',
    },
  },
  {
    id: 'energy-pack', name: '能量', description: '恢复 1 格游戏能量', price: 320, icon: '⚡', tone: 'yellow', kind: 'instant',
    manual: {
      effect: '从背包使用后立即恢复 1 格能量。',
      timing: '购买后进入背包，由玩家主动使用。',
      limit: '最多恢复到 5 格；满能量时不能使用但可以继续持有。',
      endless: '只影响进入游戏的能量，不改变无尽模式难度。',
    },
  },
])

export const ITEM_BY_ID = Object.freeze(Object.fromEntries(ITEM_CATALOG.map((item) => [item.id, item])))

export const EMPTY_INVENTORY = Object.freeze(Object.fromEntries(ITEM_CATALOG.map((item) => [item.id, 0])))
