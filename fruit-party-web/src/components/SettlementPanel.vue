<template>
  <main class="settlement-page" :class="{ 'endless-mode': isEndless }" data-test="settlement-page">
    <section class="settlement-card" aria-labelledby="settlement-title">
      <header class="settlement-header" :class="{ 'is-win': passed, 'is-loss': !passed && !isEndless }">
        <div v-if="!isEndless" class="result-status" data-test="result-status"><span data-test="result-mark">{{ passed ? 'WIN' : 'LOSS' }}</span><small>{{ passed ? '通关成功' : '挑战失败' }}</small></div>
        <p class="settlement-kicker">{{ isEndless ? '无尽模式' : `${modeLabel}模式 · 第 ${levelNumber} 关` }}</p>
        <h1 id="settlement-title">{{ isEndless ? '无尽结算' : (passed ? '挑战成功' : '本局结算') }}</h1>
      </header>
      <section v-if="isEndless" class="score-panel endless-score-panel" data-test="endless-score-breakdown" aria-label="无尽最终分数">
        <p class="endless-time">本局用时 {{ formattedElapsedTime }}</p>
        <div class="endless-score-equation">
          <div class="score-line"><span>基础分</span><strong>{{ formatScore(displayedBaseScore) }}</strong></div>
          <b class="score-operator">+</b>
          <div class="score-line performance-line"><span>综合评分</span><strong>{{ formatScore(displayedPerformanceScore) }}</strong></div>
          <b class="score-operator">=</b>
        </div>
        <div class="score-total"><span>最终得分</span><strong>{{ formatScore(displayedScore) }}</strong></div>
      </section>
      <section v-else class="score-panel campaign-score-panel" aria-label="最终分数">
        <span>最终得分</span><strong class="settlement-score">{{ formatScore(displayedScore) }}</strong>
        <small>目标 {{ formatScore(targetScore) }} 分</small>
        <small v-if="!passed && scoreGap > 0" class="score-gap">还差 {{ formatScore(scoreGap) }} 分</small>
      </section>
      <section v-if="!isEndless" class="score-details" data-test="score-details" aria-label="本局统计">
        <article><span>基础分</span><strong>{{ formatScore(baseScore) }}</strong></article>
        <article><span>表现加分</span><strong>+{{ formatScore(performanceScore) }}</strong></article>
        <article><span>命中率</span><strong>{{ formattedHitRate }}</strong></article>
        <article class="reward-detail" aria-label="金币获得">
          <span class="reward-label">金币获得</span>
          <strong class="coin-reward-value" data-test="coins-awarded">
            <i class="coin-reward-icon" data-test="coin-reward-icon" aria-hidden="true">¥</i>
            <em>+{{ formatScore(coinsAwarded) }}</em>
          </strong>
        </article>
      </section>
      <p class="settlement-caption">{{ isEndless ? '本局成绩已记录，继续挑战下一次极限。' : (passed ? '下一关已经解锁' : (canAdvance ? '本关已通过过，可直接进入下一关' : '再来一次，突破目标分数')) }}</p>
      <div class="settlement-actions" :class="{ 'is-endless': isEndless }" data-test="settlement-actions">
        <button class="settlement-button secondary" type="button" data-test="return-hub" @click="$emit('return-hub')">返回大厅</button>
        <button v-if="!isEndless && (passed || canAdvance)" class="settlement-button primary" type="button" data-test="next-level" @click="$emit('next-level')">下一关</button>
        <button v-else-if="!isEndless" class="settlement-button primary retry-button" type="button" data-test="retry-level" @click="$emit('retry-level')">再来一次</button>
      </div>
    </section>
  </main>
</template>

<script>
export default {
  name: 'SettlementPanel',
  props: {
    mode: { type: String, required: true }, levelNumber: { type: Number, default: 1 }, finalScore: { type: Number, required: true }, baseScore: { type: Number, default: 0 }, performanceScore: { type: Number, default: 0 }, targetScore: { type: Number, default: 0 }, hitRate: { type: Number, default: 0 }, elapsedSeconds: { type: Number, default: 0 }, coinsAwarded: { type: Number, default: 0 }, passed: { type: Boolean, default: false }, canAdvance: { type: Boolean, default: false },
  },
  data() { return { displayedScore: 0, displayedBaseScore: 0, displayedPerformanceScore: 0, animationFrame: null, animationTimer: null } },
  computed: {
    isEndless() { return this.mode === 'endless' },
    modeLabel() { return this.mode === 'hard' ? '困难' : '普通' },
    scoreGap() { return Math.max(0, this.numberValue(this.targetScore) - this.numberValue(this.finalScore)) },
    formattedHitRate() { return `${Math.round(Math.max(0, Math.min(1, this.numberValue(this.hitRate))) * 100)}%` },
    formattedElapsedTime() { const elapsed = this.numberValue(this.elapsedSeconds); return `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}` },
  },
  mounted() {
    if (this.isEndless) this.animateNumber(this.baseScore, 360, 'displayedBaseScore', () => { this.animationTimer = window.setTimeout(() => this.animateNumber(this.performanceScore, 320, 'displayedPerformanceScore', () => { this.animationTimer = window.setTimeout(() => this.animateNumber(this.finalScore, 460, 'displayedScore'), 100) }), 100) })
    else this.animateNumber(this.finalScore, 560, 'displayedScore')
  },
  beforeDestroy() { if (this.animationFrame) window.cancelAnimationFrame?.(this.animationFrame); window.clearTimeout(this.animationTimer) },
  methods: {
    numberValue(value) { return Math.max(0, Number(value) || 0) },
    formatScore(value) { return this.numberValue(value).toLocaleString('zh-CN') },
    animateNumber(target, duration, property, complete) {
      const value = this.numberValue(target); const startedAt = performance.now()
      const tick = (now) => { const progress = Math.min(1, (now - startedAt) / duration); this[property] = Math.round(value * (1 - ((1 - progress) ** 3))); if (progress < 1) this.animationFrame = window.requestAnimationFrame(tick); else complete?.() }
      this.animationFrame = window.requestAnimationFrame(tick)
    },
  },
}
</script>

<style scoped>
.settlement-page { display: grid; min-height: 100vh; place-items: center; padding: 28px 20px; background: #060b17; color: #eef4ff; }.settlement-card { width: min(720px, 100%); padding: 32px; border: 1px solid #344f70; border-radius: 4px; background: #0c1929; box-shadow: 0 24px 56px #000a; animation: surface-enter 360ms ease both; }.settlement-header { display: grid; justify-items: center; gap: 7px; text-align: center; }.settlement-kicker { margin: 0; color: #dfb956; font-size: 11px; font-weight: 700; letter-spacing: 1.4px; }.settlement-header h1 { margin: 0; font-size: 28px; }
.score-panel { display: grid; justify-items: center; gap: 6px; margin-top: 22px; padding: 24px; border: 1px solid #385575; background: #101f32; text-align: center; }.score-panel > span, .score-panel small { color: #aebfd3; font-size: 12px; }.settlement-score { color: #ffd66c; font-size: 58px; line-height: 1; text-shadow: 0 0 20px #d6a73b3d; }.score-gap { color: #ef9298 !important; }.score-details { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 14px; border: 1px solid #2f4b68; background: #0a1726; }.score-details article { display: grid; gap: 5px; min-width: 0; padding: 14px 12px; text-align: center; }.score-details article + article { border-left: 1px solid #2f4b68; }.score-details span { color: #8ca4bc; font-size: 11px; }.score-details strong { overflow: hidden; color: #e8f0f8; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }.score-details .reward-detail strong { color: #f2cd69; }.reward-label { color: #8ca4bc; font-size: 11px; }.coin-reward-value { display: inline-flex; align-items: center; justify-content: center; gap: 5px; overflow: visible; color: #f2cd69 !important; }.coin-reward-value em { font-style: normal; }.coin-reward-icon { display: grid; width: 20px; height: 20px; place-items: center; border: 1px solid #f2bd4c; border-radius: 50%; background: radial-gradient(circle at 34% 28%, #ffeaa0 0 11%, #f6ca5b 35%, #c8841e 100%); box-shadow: inset 0 0 0 1px #a96818, 0 2px 5px #0007; color: #9a5b12; font-size: 10px; font-style: normal; font-weight: 900; line-height: 1; }
.settlement-caption { margin: 18px 0 22px; color: #9aafc5; font-size: 13px; text-align: center; }.settlement-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }.settlement-actions.is-endless { grid-template-columns: minmax(170px, 240px); justify-content: center; }.settlement-button { min-height: 42px; border-radius: 4px; font: inherit; font-weight: 700; cursor: pointer; }.settlement-button.secondary { border: 1px solid #5b7393; background: #12243b; color: #dce7f4; }.settlement-button.primary { border: 1px solid #ca9d42; background: #9f742b; color: #fff7df; }
.endless-mode .settlement-card { border-color: #64562d; }.endless-score-panel { border-color: #806a31; background: #171c26; }.endless-time { margin: 0; color: #b3c2d2; font-size: 12px; }.endless-score-equation { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 11px; }.score-line { display: grid; gap: 3px; justify-items: center; }.score-line span { color: #aebfd3; font-size: 11px; }.score-line strong { color: #f5d36d; font-size: 31px; }.performance-line strong { color: #93d4fb; }.score-operator { color: #d5b65e; font-size: 22px; }.score-total { display: grid; justify-items: center; gap: 5px; width: min(420px, 100%); padding-top: 12px; border-top: 1px solid #806a31; }.score-total span { color: #bdc9d5; font-size: 12px; }.score-total strong { color: #ffe294; font-size: 58px; line-height: 1; text-shadow: 0 0 18px #d5a23f3b; }
@media (max-width: 560px) { .settlement-page { padding: 18px 14px; }.settlement-card { padding: 24px 16px; }.score-details { grid-template-columns: repeat(2, minmax(0, 1fr)); }.score-details article:nth-child(3) { border-top: 1px solid #2f4b68; border-left: 0; }.score-details article:nth-child(4) { border-top: 1px solid #2f4b68; }.settlement-score, .score-total strong { font-size: 48px; }.settlement-actions { grid-template-columns: 1fr; }.settlement-actions.is-endless { grid-template-columns: minmax(170px, 240px); }.endless-score-equation { gap: 8px; }.score-line strong { font-size: 27px; } }
.settlement-card { border-radius: 8px; }.result-status { display: grid; gap: 2px; justify-items: center; margin-bottom: 5px; }.result-status span { padding: 5px 12px; border: 1px solid #cba445; border-radius: 4px; color: #ffe08b; font-size: 13px; font-weight: 900; letter-spacing: 2px; line-height: 1; }.result-status small { color: #d9bd71; font-size: 10px; letter-spacing: 1px; }.settlement-header.is-loss .result-status span { border-color: #a85763; color: #ffb5bf; }.settlement-header.is-loss .result-status small, .settlement-header.is-loss .settlement-kicker { color: #e28d99; }.settlement-button { border-radius: 6px; }.settlement-button.retry-button { border-color: #b5655e; background: #553239; color: #ffe8e7; }
</style>
