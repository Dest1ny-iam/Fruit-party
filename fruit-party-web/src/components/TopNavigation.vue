<template>
  <!-- 顶部导航只放全局入口，不放商店商品或通知内容。 -->
  <nav class="top-navigation" aria-label="全局导航">
    <button class="navigation-button" type="button" data-test="shop-button" title="商店">
      <span class="navigation-icon" aria-hidden="true">◇</span>
      <span>商店</span>
    </button>
    <button class="navigation-button" type="button" data-test="notifications-button" title="通知">
      <span class="navigation-icon notification-icon" aria-hidden="true">◌</span>
      <span>通知</span>
    </button>
    <!-- 充值入口保留给后续功能；目前点击仅显示开发状态。 -->
    <button class="navigation-button recharge-button" type="button" data-test="recharge-button" title="充值" @click="showRechargeNotice">
      <span class="navigation-icon" aria-hidden="true">+</span>
      <span>充值</span>
    </button>

    <!-- v-if 为 true 才创建提示元素，避免未点击时占据页面空间。 -->
    <p v-if="showRechargeMessage" class="recharge-message" data-test="recharge-message" role="status">未开发</p>
  </nav>
</template>

<script>
export default {
  name: 'TopNavigation',
  data() {
    // 这是组件内部的临时 UI 状态，不需要传到 App.vue。
    return { showRechargeMessage: false, rechargeTimer: null }
  },
  methods: {
    // 每次点击都重置计时，保证提示从最近一次点击开始完整显示 3 秒。
    showRechargeNotice() {
      clearTimeout(this.rechargeTimer)
      this.showRechargeMessage = true
      this.rechargeTimer = setTimeout(() => {
        this.showRechargeMessage = false
        this.rechargeTimer = null
      }, 3000)
    },
  },
  // Vue 2 组件销毁前清除计时器，避免页面离开后仍修改已经销毁的组件。
  beforeDestroy() {
    clearTimeout(this.rechargeTimer)
  },
}
</script>

<style scoped>
/* 绝对定位让导航固定在大厅右上角，不影响居中的挑战卡排版。 */
.top-navigation { position: absolute; top: 26px; right: 34px; z-index: 2; display: flex; align-items: center; gap: 8px; }
.navigation-button { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 10px; border: 1px solid #273d5c; border-radius: 4px; background: #0b1424cc; color: #afbed4; font-size: 12px; }
.navigation-icon { display: grid; width: 15px; height: 15px; place-items: center; color: #d6b65b; font-size: 17px; line-height: 1; }
.notification-icon { font-size: 21px; transform: translateY(-1px); }
.recharge-button { border-color: #71603a; color: #e9d18a; }
.recharge-message { position: absolute; top: 42px; right: 0; width: max-content; margin: 0; padding: 7px 10px; border: 1px solid #665632; border-radius: 3px; background: #17140dcc; color: #f0d981; font-size: 11px; }
@media (max-width: 700px) { .top-navigation { top: 20px; right: 20px; } .navigation-button { padding: 0 7px; } }
</style>
