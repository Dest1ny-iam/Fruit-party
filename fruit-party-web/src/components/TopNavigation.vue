<template>
  <!-- 顶部导航只放全局入口，不放商店商品或通知内容。 -->
  <nav class="top-navigation" aria-label="全局导航">
    <div class="coin-balance" data-test="coin-balance" aria-label="当前金币">
      <span class="coin-balance-icon" data-test="coin-balance-icon" aria-label="金币" aria-hidden="false">¥</span>
      <strong>{{ infiniteCoins ? '∞' : coins }}</strong>
    </div>
    <div class="energy-status" data-test="energy-status" aria-label="当前能量">
      <div class="energy-main">
        <span class="energy-label">能量</span>
        <span class="energy-bars" aria-hidden="true">
          <i v-for="slot in maxEnergy" :key="slot" :class="{ 'is-filled': slot <= energy }"></i>
        </span>
        <strong data-test="energy-count">{{ infiniteEnergy ? '∞' : `${energy}/${maxEnergy}` }}</strong>
      </div>
      <small v-if="showEnergyCountdown" class="energy-countdown" data-test="energy-recovery-countdown">恢复 {{ formattedEnergyCountdown }}</small>
    </div>
    <button class="navigation-button" type="button" data-test="shop-button" title="商店" @click="$emit('open-panel', 'shop')">
      <span class="navigation-icon" aria-hidden="true">◇</span>
      <span>商店</span>
    </button>
    <button class="navigation-button" type="button" data-test="notifications-button" title="通知" @click="$emit('open-panel', 'notifications')">
      <span class="navigation-icon notification-icon" aria-hidden="true">◌</span>
      <span>通知</span>
    </button>
    <button class="navigation-button" type="button" data-test="backpack-button" title="背包" @click="$emit('open-panel', 'inventory')">
      <span class="navigation-icon" aria-hidden="true">▣</span>
      <span>背包</span>
    </button>
    <button class="navigation-button recharge-button" type="button" data-test="recharge-button" title="充值" @click="$emit('open-panel', 'recharge')">
      <span class="navigation-icon" aria-hidden="true">+</span>
      <span>充值</span>
    </button>

  </nav>
</template>

<script>
export default {
  name: 'TopNavigation',
  props: {
    energy: { type: Number, default: 5 },
    coins: { type: Number, default: 0 },
    infiniteCoins: { type: Boolean, default: false },
    infiniteEnergy: { type: Boolean, default: false },
    energyRemainingSeconds: { type: Number, default: 0 },
  },
  data() {
    return { maxEnergy: 5 }
  },
  computed: {
    showEnergyCountdown() {
      return !this.infiniteEnergy && this.energy < this.maxEnergy && this.energyRemainingSeconds > 0
    },
    formattedEnergyCountdown() {
      const seconds = Math.max(0, Math.ceil(Number(this.energyRemainingSeconds) || 0))
      return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
    },
  },
}
</script>

<style scoped>
/* 绝对定位让导航固定在大厅右上角，不影响居中的挑战卡排版。 */
.top-navigation { position: absolute; top: 26px; right: 34px; z-index: 2; display: flex; align-items: center; gap: 8px; }
.coin-balance { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 9px; border: 1px solid #6d572b; border-radius: 4px; background: #0b1424cc; color: #f1d474; font-size: 12px; }
.coin-balance-icon { display: grid; width: 21px; height: 21px; place-items: center; border: 1px solid #f2bd4c; border-radius: 50%; background: radial-gradient(circle at 34% 28%, #ffeaa0 0 11%, #f6ca5b 35%, #c8841e 100%); box-shadow: inset 0 0 0 1px #a96818, 0 2px 5px #0007; color: #9a5b12; font-size: 11px; font-weight: 900; line-height: 1; }
.energy-status { display: grid; min-height: 34px; justify-items: center; align-content: center; gap: 2px; padding: 4px 10px; border: 1px solid #284563; border-radius: 4px; background: #0b1424cc; color: #bbcae0; font-size: 11px; }
.energy-main { display: inline-flex; align-items: center; gap: 7px; }.energy-label { color: #d7e5f8; }.energy-bars { display: inline-flex; gap: 3px; }.energy-bars i { display: block; width: 8px; height: 16px; border: 1px solid #425a77; border-radius: 2px; background: #152236; }.energy-bars i.is-filled { border-color: #d5b951; background: #e4c65a; box-shadow: 0 0 6px #e4c65a88; }.energy-status strong { color: #e4c65a; font-size: 11px; }.energy-countdown { color: #8296b2; font-size: 9px; font-variant-numeric: tabular-nums; line-height: 1.15; white-space: nowrap; }
.navigation-button { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 10px; border: 1px solid #273d5c; border-radius: 4px; background: #0b1424cc; color: #afbed4; font-size: 12px; }
.navigation-icon { display: grid; width: 15px; height: 15px; place-items: center; color: #d6b65b; font-size: 17px; line-height: 1; }
.notification-icon { font-size: 21px; transform: translateY(-1px); }
.recharge-button { border-color: #71603a; color: #e9d18a; }
@media (max-width: 700px) { .top-navigation { position: relative; top: auto; right: auto; box-sizing: border-box; width: 100%; justify-content: space-between; gap: 4px; padding: 12px 12px 0; }.coin-balance { gap: 4px; padding: 0 6px; }.coin-balance-icon { width: 19px; height: 19px; }.energy-status { padding: 4px 6px; }.energy-main { gap: 4px; }.energy-label { display: none; }.energy-bars { gap: 2px; }.energy-bars i { width: 7px; }.navigation-button { flex: 0 0 34px; width: 34px; justify-content: center; padding: 0; }.navigation-button > span:last-child { display: none; } }
</style>
