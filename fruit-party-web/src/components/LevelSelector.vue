<template>
  <main class="level-page" :class="{ 'hard-mode': mode === 'hard' }">
    <header>
      <button class="back-button" type="button" @click="$emit('back')">返回大厅</button>
      <p>CAMPAIGN</p>
      <h1>选择关卡</h1>
    </header>

    <!-- 只展示服务端已解锁的关卡，下一关会在本关通关后实时出现。 -->
    <section class="level-grid" aria-label="闯关关卡">
      <button
        v-for="level in visibleLevels"
        :key="level.levelNumber"
        class="level-button"
        type="button"
        :data-test="`level-${level.levelNumber}`"
        @click="$emit('start', level)"
      >
        <div class="level-title-row">
          <strong>第 {{ level.levelNumber }} 关</strong>
          <i v-if="isCompleted(level)" class="played-mark">通关</i>
        </div>
        <small>目标 {{ level.targetScore }} 分</small>
        <span v-if="hasPlayed(level)" class="best-score">最佳 {{ formatScore(level.bestScore) }} 分</span>
        <span v-else class="first-run">尚未挑战</span>
        <span class="level-action">{{ hasPlayed(level) ? '再次挑战' : '开始挑战' }}</span>
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
    mode: { type: String, default: 'normal' },
    // 内测账号保留直接选关能力；普通账号只能看到已通关进度之后的下一关。
    allowAllLevels: { type: Boolean, default: false },
  },
  computed: {
    visibleLevels() {
      const orderedLevels = [...this.levels].sort((left, right) => Number(left.levelNumber) - Number(right.levelNumber))
      if (this.allowAllLevels) return orderedLevels.filter((level) => level.unlocked)
      return orderedLevels.filter((level, index) => level.unlocked && (index === 0 || Boolean(orderedLevels[index - 1].completedAt)))
    },
  },
  methods: {
    hasPlayed(level) {
      return Number(level.bestScore) > 0 || Boolean(level.completedAt)
    },
    isCompleted(level) {
      return Boolean(level.completedAt)
    },
    formatScore(score) {
      return Math.max(0, Number(score) || 0).toLocaleString('zh-CN')
    },
  },
}
</script>

<style scoped>
.level-page { min-height: 100vh; padding: 36px 24px; background: #09172d; color: #eff5ff; }
.level-page.hard-mode { background: #09131e; }
.hard-mode header p { color: #cb7b80; }
.hard-mode .back-button:hover { border-color: #bc6b72; color: #f2bec1; }
header { max-width: 760px; margin: 0 auto 30px; }
header p { margin: 18px 0 7px; color: #ffd36a; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
h1 { margin: 0; font-size: 27px; }
.back-button { min-height: 34px; padding: 0 12px; border: 1px solid #58719a; border-radius: 5px; background: transparent; color: #dce8f8; }
.back-button:hover { border-color: #ffd36a; color: #ffd36a; }

.level-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; max-width: 760px; margin: 0 auto; }
.level-button { min-height: 158px; padding: 18px; border: 1px solid #506991; border-radius: 7px; background: #172b4d; color: #f7f9ff; text-align: left; animation: surface-enter 320ms ease both; }
.level-button:hover:not(:disabled) { border-color: #dfb752; background: #1d365e; box-shadow: 0 12px 20px #02091573; transform: translateY(-3px); }
.hard-mode .level-button { border-color: #713f4a; background: #1c1a21; }
.hard-mode .level-button:hover:not(:disabled) { border-color: #b76068; background: #282027; }
.level-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.level-button strong, .level-button small, .level-button span { display: block; }
.level-button small { margin: 8px 0 7px; color: #b7c7dd; }
.hard-mode .level-button small { color: #d2afb6; }
.played-mark { padding: 3px 6px; border: 1px solid #d9a63a; border-radius: 3px; background: #3b2c0d; color: #ffd36a; font-size: 9px; font-style: normal; }
.best-score { color: #f4d36d; font-size: 13px; font-weight: 700; }
.hard-mode .best-score { color: #e79ba2; }
.first-run { color: #89a2be; font-size: 12px; }
.hard-mode .first-run { color: #b99197; }
.level-action { margin-top: 13px; color: #ffd36a; font-size: 12px; font-weight: 700; }
.hard-mode .level-action { color: #dd8990; }
.level-button:disabled { border-color: #415575; background: #10203c; color: #8fa1bb; cursor: not-allowed; }
.level-button:disabled small { color: #8fa1bb; }
</style>
