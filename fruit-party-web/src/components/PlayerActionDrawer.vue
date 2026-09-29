<template>
  <section class="action-drawer" role="dialog" aria-modal="true" :aria-label="title">
    <header><h2>{{ title }}</h2><button type="button" class="drawer-close" @click="$emit('close')">关闭</button></header>
    <p v-if="error" class="drawer-error">{{ error }}</p>
    <p v-else-if="loading" class="drawer-status">加载中…</p>

    <div v-else-if="panel === 'shop'" class="drawer-list">
      <article v-for="item in records" :key="item.id" class="drawer-card">
        <div><h3>{{ item.displayName }}</h3><p>{{ item.description }}</p></div>
        <div class="shop-action"><strong>{{ item.priceCoins }} 金币</strong><button :data-test="`buy-item-${item.id}`" type="button" @click="purchase(item)">购买 1 个</button></div>
      </article>
      <p v-if="!records.length" class="drawer-status">暂无可购买道具</p>
    </div>

    <div v-else-if="panel === 'notifications'" class="drawer-list">
      <article v-for="notification in records" :key="notification.id" class="drawer-card notification-card" :class="{ 'is-read': notification.read }" @click="read(notification)">
        <div><h3><i v-if="!notification.read" aria-label="未读" />{{ notification.title }}</h3><p>{{ notification.body }}</p></div>
        <button type="button" class="delete-button" @click.stop="remove(notification)">删除</button>
      </article>
      <p v-if="!records.length" class="drawer-status">暂时没有通知</p>
    </div>

    <div v-else-if="panel === 'inventory'" class="drawer-list">
      <article v-for="item in records" :key="item.itemKey" class="drawer-card inventory-card">
        <div class="inventory-copy">
          <span class="inventory-icon" aria-hidden="true">{{ itemDefinition(item.itemKey).icon || '◇' }}</span>
          <div>
            <h3>{{ item.displayName }}</h3>
            <p>{{ item.description }}</p>
            <small :data-test="`inventory-count-${item.itemKey}`">持有 {{ item.quantity }} 张</small>
          </div>
        </div>
        <button
          v-if="isDirectUseItem(item.itemKey)"
          class="inventory-action"
          :data-test="`use-item-${item.itemKey}`"
          type="button"
          :disabled="usingItemKey === item.itemKey"
          @click="useItem(item)"
        >{{ usingItemKey === item.itemKey ? '使用中…' : '使用' }}</button>
        <button
          v-else
          class="inventory-action"
          :class="{ selected: selectedGameItems.includes(item.itemKey) }"
          :data-test="`select-item-${item.itemKey}`"
          type="button"
          @click="$emit('game-item-toggle', item.itemKey)"
        >{{ selectedGameItems.includes(item.itemKey) ? '已携带' : '下局携带' }}</button>
      </article>
      <p v-if="!records.length" class="drawer-status">背包里暂时没有道具</p>
      <p v-if="records.length" class="inventory-note">携带型道具会在下一次进入游戏时扣除；每种固定使用 1 张。</p>
    </div>

    <div v-else class="drawer-list">
      <article v-for="product in records" :key="product.id" class="drawer-card">
        <div><h3>{{ product.displayName }}</h3><p>{{ product.description }}</p></div>
        <div class="shop-action"><strong>{{ (product.priceCents / 100).toFixed(2) }} 元</strong><button type="button" @click="createOrder(product)">获取收款码</button></div>
      </article>
      <p v-if="!records.length" class="drawer-status">暂无充值商品</p>
      <section v-if="order" class="qr-order">
        <img :src="order.qrCodeUrl" alt="收款二维码" @error="qrUnavailable = true">
        <p v-if="qrUnavailable">收款二维码暂不可用，请联系管理员更新商品二维码。</p>
        <p v-else>请在 {{ expiryLabel }} 前扫码，超时后此订单自动失效。</p>
      </section>
    </div>
  </section>
</template>

<script>
import { ITEM_BY_ID } from '../data/item-data'

export default {
  name: 'PlayerActionDrawer',
  props: {
    panel: { type: String, required: true },
    api: { type: Object, required: true },
    selectedGameItems: { type: Array, default: () => [] },
  },
  data() { return { records: [], loading: true, error: '', order: null, qrUnavailable: false, usingItemKey: '' } },
  computed: {
    title() { return ({ shop: '商店', inventory: '背包', notifications: '通知', recharge: '充值' })[this.panel] || '' },
    expiryLabel() { return this.order ? new Date(this.order.expiresAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '' },
  },
  watch: { panel: { immediate: true, handler() { this.load() } } },
  methods: {
    async load() {
      this.loading = true; this.error = ''; this.order = null
      try {
        const load = { shop: 'getShopItems', inventory: 'getInventory', notifications: 'getNotifications', recharge: 'getRechargeProducts' }[this.panel]
        this.records = await this.api[load]()
      } catch (error) { this.error = error.message || '加载失败，请稍后重试' } finally { this.loading = false }
    },
    requestId() { return `shop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` },
    async purchase(item) {
      try { const result = await this.api.purchaseItem({ itemId: item.id, quantity: 1, requestId: this.requestId() }); this.$emit('wallet-changed', result) } catch (error) { this.error = error.message || '购买失败' }
    },
    itemDefinition(itemKey) { return ITEM_BY_ID[itemKey] || {} },
    isDirectUseItem(itemKey) { return ['energy-pack', 'coin-boost'].includes(itemKey) },
    async useItem(item) {
      this.error = ''
      this.usingItemKey = item.itemKey
      try {
        const result = await this.api.useInventoryItem(item.itemKey)
        item.quantity = Math.max(0, Number(item.quantity) - 1)
        this.records = this.records.filter((record) => Number(record.quantity) > 0)
        this.$emit('wallet-changed', result)
      } catch (error) { this.error = error.message || '使用道具失败' } finally { this.usingItemKey = '' }
    },
    async read(notification) {
      if (notification.read) return
      try { await this.api.readNotification(notification.id); notification.read = true } catch (error) { this.error = error.message || '更新通知状态失败' }
    },
    async remove(notification) {
      try { await this.api.deleteNotification(notification.id); this.records = this.records.filter((record) => record.id !== notification.id) } catch (error) { this.error = error.message || '删除通知失败' }
    },
    async createOrder(product) {
      try { this.qrUnavailable = false; this.order = await this.api.createRechargeOrder(product.id) } catch (error) { this.error = error.message || '创建订单失败' }
    },
  },
}
</script>

<style scoped>
.action-drawer { position: fixed; top: 0; right: 0; z-index: 20; display: flex; flex-direction: column; width: min(460px, 100vw); height: 100vh; padding: 22px; border-left: 1px solid #354968; background: #0a1423; box-shadow: -16px 0 40px #0008; color: #edf4ff; }
.action-drawer header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid #263954; }.action-drawer h2, .drawer-card h3 { margin: 0; }.action-drawer h2 { font-size: 18px; }.drawer-close, .shop-action button, .delete-button { min-height: 34px; border: 1px solid #795f2f; border-radius: 6px; background: #2b2416; color: #f1d990; font: inherit; font-size: 13px; }.drawer-close { padding: 0 11px; }.drawer-list { display: grid; gap: 10px; overflow: auto; padding: 16px 0; }.drawer-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px; border: 1px solid #263954; border-radius: 7px; background: #101c2d; }.drawer-card h3 { font-size: 15px; }.drawer-card p { margin: 6px 0 0; color: #aebed2; font-size: 13px; line-height: 1.45; }.shop-action { display: grid; flex: none; gap: 8px; text-align: right; }.shop-action strong { color: #e6c261; font-size: 13px; }.shop-action button { padding: 0 10px; }.notification-card { cursor: pointer; }.notification-card.is-read { opacity: .52; }.notification-card i { display: inline-block; width: 7px; height: 7px; margin-right: 7px; border-radius: 50%; background: #d75656; vertical-align: 2px; }.delete-button { padding: 0 8px; border-color: #624047; background: #281820; color: #eebcc3; }.drawer-status, .drawer-error { margin: 18px 0; color: #aebed2; font-size: 13px; }.drawer-error { color: #ffc4c8; }.qr-order { margin-top: auto; padding-top: 16px; text-align: center; }.qr-order img { display: block; width: min(230px, 100%); aspect-ratio: 1; margin: 0 auto 10px; background: #fff; object-fit: contain; }.qr-order p { margin: 0; color: #aebed2; font-size: 12px; }
.inventory-copy { display: flex; min-width: 0; align-items: center; gap: 12px; }.inventory-icon { display: grid; flex: 0 0 38px; width: 38px; height: 38px; place-items: center; border: 1px solid #4d607b; border-radius: 50%; background: #0a1423; color: #e6c261; font-size: 19px; }.inventory-copy small { display: block; margin-top: 7px; color: #e2c76e; font-size: 11px; }.inventory-action { flex: 0 0 auto; min-width: 76px; min-height: 34px; padding: 0 10px; border: 1px solid #435c7c; border-radius: 6px; background: #162640; color: #c8d7ea; font: inherit; font-size: 12px; }.inventory-action.selected { border-color: #9c7a35; background: #302713; color: #f2d375; }.inventory-action:disabled { cursor: wait; opacity: .65; }.inventory-note { margin: 2px 2px 0; color: #7f91aa; font-size: 11px; line-height: 1.5; }
</style>
