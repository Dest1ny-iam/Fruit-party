<template>
  <!-- 三张模式卡只负责展示入口并向父组件通知选择结果。 -->
  <div class="challenge-modes" aria-label="游戏模式">
    <!-- 普通模式是五关闯关流程的入口，事件由 GameHub 再交给 App.vue 处理。 -->
    <button
      class="challenge-card normal"
      type="button"
      data-test="normal-button"
      @click="$emit('select-mode', 'normal')"
    >
      <span class="mode-label">NORMAL</span>
      <strong>普通模式</strong>
      <small>十关挑战</small>
      <span class="fruit-icon" aria-hidden="true">🍊</span>
      <span class="arrow" aria-hidden="true">→</span>
    </button>

    <!-- 困难模式本阶段先完成大厅入口；具体关卡与结算页会在游戏阶段实现。 -->
    <button
      class="challenge-card hard"
      type="button"
      data-test="hard-button"
      @click="$emit('select-mode', 'hard')"
    >
      <span class="mode-label">HARD</span>
      <strong>困难模式</strong>
      <small>挑战你的极限</small>
      <span class="fruit-icon" aria-hidden="true">🍒</span>
      <span class="arrow" aria-hidden="true">→</span>
    </button>

    <!-- :disabled 使用普通模式的最高通关关数判断，五关完成前浏览器会阻止 click。 -->
    <button
      class="challenge-card endless"
      type="button"
      data-test="endless-button"
      :disabled="!isEndlessUnlocked"
      @click="$emit('select-mode', 'endless')"
    >
      <span class="mode-label">ENDLESS</span>
      <strong>无尽模式</strong>
      <small>{{ isEndlessUnlocked ? '冲击最高分' : '完成普通模式第 5 关解锁' }}</small>
      <span class="fruit-icon" aria-hidden="true">🍇</span>
      <span v-if="!isEndlessUnlocked" class="lock" data-test="endless-lock">未解锁</span>
      <span v-else class="arrow" aria-hidden="true">→</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'ChallengeModes',
  props: {
    // App.vue 保存玩家当前普通模式进度，再经 GameHub 传给本组件。
    highestLevel: {
      type: Number,
      required: true,
    },
  },
  computed: {
    // 计算属性会在 highestLevel 改变时重新计算，模板无需手动刷新。
    isEndlessUnlocked() {
      return this.highestLevel >= 5
    },
  },
}
</script>

<style scoped>
/* 纵向排列保证三种模式有同等入口权重。悬浮放大交互将在下一轮集中加入。 */
.challenge-modes { display: grid; gap: 10px; }
.challenge-card { position: relative; display: block; width: 100%; min-height: 94px; padding: 15px 18px; overflow: hidden; border: 1px solid; border-radius: 6px; color: #f5f7ff; text-align: left; box-shadow: inset 0 1px #ffffff12, 0 8px 16px #01050d66; animation: surface-enter 360ms ease both; }
.challenge-card:nth-child(2) { animation-delay: 65ms; }
.challenge-card:nth-child(3) { animation-delay: 130ms; }
.mode-label, .challenge-card strong, .challenge-card small { display: block; }
.mode-label { font-size: 10px; font-weight: 700; letter-spacing: 1.4px; }
.challenge-card strong { margin: 6px 0 4px; font-size: 18px; }
.challenge-card small { color: #c4ccdc; font-size: 12px; }
.fruit-icon { position: absolute; top: 14px; right: 20px; opacity: 0.58; font-size: 40px; }
.arrow { position: absolute; right: 20px; bottom: 14px; font-size: 21px; }
.challenge-card:not(:disabled):hover { transform: translateY(-3px); box-shadow: inset 0 1px #ffffff24, 0 14px 24px #01050d8c; }
.challenge-card:not(:disabled):hover .arrow { transform: translateX(4px); }
/* 金黄色传达“标准主流程”，同时在暗背景上保持可辨识度。 */
.normal { border-color: #c99731; background: #493611; }
.normal .mode-label, .normal .arrow { color: #ffda70; }
/* 暗红色只用于困难入口，形成危险感但不会刺眼。 */
.hard { border-color: #a7444c; background: #401d29; }
.hard .mode-label, .hard .arrow { color: #ff9b9f; }
/* 暗紫色代表无尽模式；锁定状态仍保留原本的紫色识别。 */
.endless { border-color: #7060a7; background: #2b254d; }
.endless .mode-label, .endless .arrow { color: #c1acff; }
.challenge-card:disabled { border-color: #4e4772; background: #1b1930; color: #a7a3bb; cursor: not-allowed; opacity: 0.78; }
.challenge-card:disabled small { color: #89869e; }
.lock { position: absolute; right: 14px; bottom: 13px; padding: 4px 7px; border: 1px solid #756d9b; border-radius: 3px; background: #111020; color: #bcb6d9; font-size: 11px; }
</style>
