<template>
  <div class="energy-backdrop" data-test="energy-insufficient-dialog" @click.self="$emit('close')">
    <section class="energy-dialog" role="dialog" aria-modal="true" aria-labelledby="energy-dialog-title">
      <span class="energy-icon" aria-hidden="true">+</span>
      <p>ENERGY REQUIRED</p>
      <h2 id="energy-dialog-title">能量不足</h2>
      <span>下一格能量恢复</span>
      <strong data-test="energy-recovery-countdown">{{ formattedTime }}</strong>
      <button data-test="close-energy-dialog" type="button" @click="$emit('close')">知道了</button>
    </section>
  </div>
</template>

<script>
export default {
  name: 'EnergyInsufficientDialog',
  props: { remainingSeconds: { type: Number, default: 0 } },
  computed: {
    formattedTime() {
      const seconds = Math.max(0, Math.ceil(this.remainingSeconds))
      return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
    },
  },
}
</script>

<style scoped>
.energy-backdrop { position: fixed; z-index: 50; inset: 0; display: grid; place-items: center; padding: 18px; background: #02050bd9; backdrop-filter: blur(4px); }
.energy-dialog { width: min(350px, 100%); padding: 28px 26px 24px; border: 1px solid #806a34; border-radius: 8px; background: #0b1627; box-shadow: 0 25px 75px #000d; color: #edf4ff; text-align: center; }
.energy-icon { display: grid; width: 48px; height: 48px; margin: 0 auto 13px; place-items: center; border: 1px solid #d6b65b; border-radius: 50%; background: #332812; color: #ffd76a; font-size: 26px; font-weight: 700; }.energy-dialog p { margin: 0 0 5px; color: #9a8247; font-size: 10px; letter-spacing: 1.4px; }.energy-dialog h2 { margin: 0; font-size: 22px; }.energy-dialog h2 + span { display: block; margin-top: 9px; color: #91a6c3; font-size: 12px; }.energy-dialog strong { display: block; margin-top: 8px; color: #f5d16f; font-size: 30px; font-variant-numeric: tabular-nums; }.energy-dialog button { width: 100%; min-height: 40px; margin-top: 18px; border: 1px solid #806a34; border-radius: 5px; background: #302511; color: #efd477; cursor: pointer; }
</style>
