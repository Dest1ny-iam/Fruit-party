import { levelBalanceFor } from './levelBalance'

export const FRUIT_TYPES = Object.freeze([
  'apple',
  'orange',
  'watermelon',
  'banana',
  'pineapple',
  'kiwi',
  'strawberry',
  'dragonfruit',
  'cantaloupe',
  'pear',
])

export const FRUIT_CATALOG = Object.freeze({
  apple: Object.freeze({ type: 'apple', name: '苹果', emoji: '🍎', score: 15, scale: 0.88, sizeTier: 'B', size: 'medium', juice: 0xd93345 }),
  orange: Object.freeze({ type: 'orange', name: '橙子', emoji: '🍊', score: 16, scale: 0.88, sizeTier: 'B', size: 'medium', juice: 0xff982b }),
  // 西瓜仍是显著最大的目标，但略缩小以避免遮挡同一波其他水果。
  watermelon: Object.freeze({ type: 'watermelon', name: '西瓜', emoji: '🍉', score: 8, scale: 1.15, sizeTier: 'A', size: 'large', juice: 0xf04455 }),
  banana: Object.freeze({ type: 'banana', name: '香蕉', emoji: '🍌', score: 13, scale: 0.88, sizeTier: 'B', size: 'medium', juice: 0xffe06b }),
  pineapple: Object.freeze({ type: 'pineapple', name: '菠萝', emoji: '🍍', score: 12, scale: 0.88, sizeTier: 'B', size: 'medium', juice: 0xf2c84c }),
  kiwi: Object.freeze({ type: 'kiwi', name: '猕猴桃', emoji: '🥝', score: 20, scale: 0.68, sizeTier: 'C', size: 'small', juice: 0x8bbf45 }),
  strawberry: Object.freeze({ type: 'strawberry', name: '草莓', emoji: '🍓', score: 19, scale: 0.68, sizeTier: 'C', size: 'small', juice: 0xe7354f }),
  dragonfruit: Object.freeze({ type: 'dragonfruit', name: '火龙果', emoji: '🐉', score: 14, scale: 0.88, sizeTier: 'B', size: 'medium', juice: 0xea4d8e }),
  // 哈密瓜是仅次于西瓜的大型目标：略缩小后仍保留更易命中的低分定位。
  cantaloupe: Object.freeze({ type: 'cantaloupe', name: '哈密瓜', emoji: '🍈', score: 9, scale: 1.15, sizeTier: 'A', size: 'large', juice: 0xf0a45e }),
  // 梨保持中型，刚好填补菠萝与苹果之间的视觉和分值层级。
  pear: Object.freeze({ type: 'pear', name: '梨', emoji: '🍐', score: 15, scale: 0.88, sizeTier: 'B', size: 'medium', juice: 0xd9c45a }),
})

const SMALL_FRUIT_TYPES = Object.freeze(['kiwi', 'strawberry'])
const STANDARD_FRUIT_TYPES = Object.freeze([
  'watermelon', 'cantaloupe', 'pineapple', 'banana',
  'pear', 'orange', 'dragonfruit', 'apple',
])

export function fruitForIndex(index) {
  const type = FRUIT_TYPES[Math.abs(index) % FRUIT_TYPES.length]
  return FRUIT_CATALOG[type]
}

// 普通前四关保持两颗；中后期和困难模式提高基础数量，但单波永远不超过四颗。
export function fruitCountForWave(wave, level = 1, mode = 'normal') {
  if (mode === 'endless') return wave >= 20 ? 4 : 3
  const profile = levelBalanceFor(level, mode)
  const baseCount = mode === 'hard' ? 3 : level <= 4 ? 2 : 3
  const hasExtraFruit = profile.extraFruitEvery > 0
    && wave > 0
    && wave % profile.extraFruitEvery === 0
  return Math.min(4, baseCount + (hasExtraFruit ? 1 : 0))
}

// 用确定性序列逼近配置占比，不依赖随机数，确保游戏、测试和后端模拟结果一致。
export function fruitsForWave(wave, level = 1, mode = 'normal') {
  const profile = levelBalanceFor(level, mode)
  const smallFruitRatio = mode === 'endless'
    ? Math.min(0.82, profile.smallFruitRatio + Math.floor(Math.max(0, wave) / 8) * 0.06)
    : profile.smallFruitRatio
  const count = fruitCountForWave(wave, level, mode)

  return Array.from({ length: count }, (_, offset) => {
    const modeOffset = mode === 'hard' ? 17 : mode === 'endless' ? 31 : 0
    const selector = (Math.max(0, wave) * 29 + offset * 47 + Math.max(1, level) * 11 + modeOffset) % 100
    const pool = selector < smallFruitRatio * 100 ? SMALL_FRUIT_TYPES : STANDARD_FRUIT_TYPES
    const poolIndex = (Math.max(0, wave) * 3 + offset + Math.max(1, level) - 1) % pool.length
    return FRUIT_CATALOG[pool[poolIndex]]
  })
}
