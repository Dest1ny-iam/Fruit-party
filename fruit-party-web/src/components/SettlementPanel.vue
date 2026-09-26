<template>
  <main class="settlement-page">
    <section class="settlement-card" aria-labelledby="settlement-title">
      <p class="settlement-kicker">{{ mode === 'endless' ? 'ENDLESS RESULT' : 'LEVEL RESULT' }}</p>
      <h1 id="settlement-title">{{ mode === 'endless' ? '本局结算' : (passed ? '通关' : '挑战结束') }}</h1>
      <strong class="settlement-score">{{ formattedScore }}</strong>
      <p class="settlement-caption">{{ mode === 'endless' ? '无尽挑战已记录本局最高成绩' : (passed ? '下一关已经解锁' : '再试一次，突破目标分数') }}</p>

      <div class="settlement-actions" :class="{ 'is-endless': mode === 'endless' }" data-test="settlement-actions">
        <button class="settlement-button secondary" type="button" data-test="return-hub" @click="$emit('return-hub')">返回大厅</button>
        <button v-if="mode !== 'endless' && passed" class="settlement-button primary" type="button" data-test="next-level" @click="$emit('next-level')">下一关</button>
      </div>
    </section>
  </main>
</template>

<script>
export default {
  name: 'SettlementPanel',
  props: {
    mode: { type: String, required: true },
    finalScore: { type: Number, required: true },
    passed: { type: Boolean, default: false },
  },
  computed: {
    formattedScore() {
      return this.finalScore.toLocaleString('zh-CN')
    },
  },
}
</script>

<style scoped>
.settlement-page { display: grid; min-height: 100vh; place-items: center; padding: 24px; background: #07111f; color: #f2f6fb; }
.settlement-card { width: min(100%, 450px); padding: 38px 30px 30px; border: 1px solid #36516f; border-radius: 10px; background: #0e1c2f; text-align: center; box-shadow: 0 22px 48px #000814a8; animation: surface-enter 420ms cubic-bezier(.2, .8, .2, 1) both; }
.settlement-kicker { margin: 0; color: #e5bd60; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; }
h1 { margin: 9px 0 12px; font-size: 27px; }
.settlement-score { display: block; color: #f5cf73; font-size: 42px; line-height: 1; text-shadow: 0 0 20px #e6b84942; animation: surface-enter 560ms 100ms ease both; }
.settlement-caption { margin: 14px 0 27px; color: #aebed2; font-size: 13px; }
.settlement-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.settlement-actions.is-endless { grid-template-columns: minmax(160px, 220px); justify-content: center; }
.settlement-button { min-height: 42px; border-radius: 6px; font-weight: 700; }
.settlement-button.secondary { border: 1px solid #5c7390; background: #162941; color: #e4edf8; }
.settlement-button.primary { border: 1px solid #c99639; background: #a97928; color: #fff8df; }
</style>
