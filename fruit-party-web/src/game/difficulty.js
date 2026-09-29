import { levelBalanceFor } from './levelBalance'

// 关卡编号决定开局压力，波次只负责一局内部的小幅递增。
export function difficultyForWave(wave, { level = 1, mode = 'normal' } = {}) {
  const profile = levelBalanceFor(level, mode)
  const waveStep = mode === 'endless' ? 5 : mode === 'hard' ? 8 : 10
  const stage = Math.min(8, Math.floor(Math.max(0, wave) / waveStep))
  return {
    // 开局速度来自关卡配置；局内每档只提高 4%，总速度封顶防止不可玩。
    speedMultiplier: Math.min(1.65, profile.baseSpeed + stage * (mode === 'endless' ? 0.06 : 0.04)),
    // 最密集也只能每两波出现一次炸弹，始终给玩家留下纯水果波次。
    bombEvery: Math.max(2, profile.bombEvery - Math.floor(stage / 2)),
    extraFruitEvery: profile.extraFruitEvery,
  }
}
