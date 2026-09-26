<template>
  <main class="level-page">
    <header>
      <button class="back-button" type="button" @click="$emit('back')">返回大厅</button>
      <p>CAMPAIGN</p>
      <h1>选择关卡</h1>
    </header>

    <!-- level.number <= highestLevel 时按钮可用；其他关卡保留在列表中但被禁用。 -->
    <section class="level-grid" aria-label="闯关关卡">
      <button
        v-for="level in levels"
        :key="level.levelNumber"
        class="level-button"
        type="button"
        :data-test="`level-${level.levelNumber}`"
        :disabled="!level.unlocked"
        @click="$emit('start', level)"
      >
        <strong>第 {{ level.levelNumber }} 关</strong>
        <small>目标 {{ level.targetScore }} 分</small>
        <!-- 未解锁关卡不显示状态文字，只通过暗色卡片和 disabled 属性表达不可用。 -->
        <span v-if="level.unlocked">开始</span>
      </button>
    </section>
  </main>
</template>

<script>
export default {
  name: 'LevelSelector',
  props: {
    // 关卡数值和解锁状态均来自 /api/me/state。
    levels: { type: Array, required: true },
  },
}
</script>

<style scoped>
.level-page { min-height: 100vh; padding: 36px 24px; background: #09172d; color: #eff5ff; }
header { max-width: 760px; margin: 0 auto 30px; }
header p { margin: 18px 0 7px; color: #ffd36a; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
h1 { margin: 0; font-size: 27px; }
.back-button { min-height: 34px; padding: 0 12px; border: 1px solid #58719a; border-radius: 5px; background: transparent; color: #dce8f8; }
.back-button:hover { border-color: #ffd36a; color: #ffd36a; }

.level-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; max-width: 760px; margin: 0 auto; }
.level-button { min-height: 140px; padding: 20px; border: 1px solid #506991; border-radius: 7px; background: #172b4d; color: #f7f9ff; text-align: left; animation: surface-enter 320ms ease both; }
.level-button:hover:not(:disabled) { border-color: #dfb752; background: #1d365e; box-shadow: 0 12px 20px #02091573; transform: translateY(-3px); }
.level-button strong, .level-button small, .level-button span { display: block; }
.level-button small { margin: 9px 0; color: #b7c7dd; }
.level-button span { color: #ffd36a; font-size: 12px; font-weight: 700; }
.level-button:disabled { border-color: #415575; background: #10203c; color: #8fa1bb; cursor: not-allowed; }
.level-button:disabled small { color: #8fa1bb; }
</style>
