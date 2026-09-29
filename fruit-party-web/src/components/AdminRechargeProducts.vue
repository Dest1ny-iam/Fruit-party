<template>
  <section class="recharge-admin" data-test="admin-recharge-products">
    <header class="recharge-header">
      <div><h2>充值商品配置</h2><p>管理玩家充值中心展示的商品、权益与收款二维码</p></div>
      <button class="secondary-action" type="button" data-test="new-recharge-product" @click="resetDraft">新增商品</button>
    </header>

    <div class="product-table-wrap">
      <table class="product-table">
        <thead><tr><th>商品</th><th>价格</th><th>发放权益</th><th>展示顺序</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td><strong>{{ product.name }}</strong><small>{{ product.description || '未填写商品说明' }}</small></td>
            <td class="product-price">¥ {{ formatNumber(product.price) }}</td>
            <td>{{ benefitLabel(product) }}</td>
            <td>{{ product.sortOrder }}</td>
            <td><span class="product-state" :class="{ enabled: product.enabled }">{{ product.enabled ? '启用' : '停用' }}</span></td>
            <td><div class="row-actions"><button class="row-action" :data-test="`edit-recharge-${product.id}`" type="button" @click="editProduct(product)">编辑</button><button class="row-action" :data-test="`toggle-recharge-${product.id}`" type="button" @click="toggleProduct(product)">{{ product.enabled ? '停用' : '启用' }}</button></div></td>
          </tr>
          <tr v-if="products.length === 0"><td colspan="6" class="empty-state">暂无充值商品，点击右上角新增</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="drawerOpen" class="drawer-backdrop" @click.self="closeDrawer">
      <aside class="product-drawer" data-test="recharge-product-drawer" aria-label="充值商品编辑">
        <header class="drawer-header">
          <div><small>RECHARGE PRODUCT</small><h3>{{ draft.id ? '编辑商品' : '新增商品' }}</h3></div>
          <button class="drawer-close" type="button" aria-label="关闭" @click="closeDrawer">×</button>
        </header>

        <form class="product-form" @submit.prevent="saveProduct">
          <div class="drawer-body">
            <section class="form-section">
              <h4>基础信息</h4>
              <label><span>商品名称</span><input v-model.trim="draft.name" data-test="recharge-name" placeholder="例如：1000 金币" required /></label>
              <div class="form-row">
                <label><span>价格（元）</span><div class="numeric-control"><input v-model.number="draft.price" data-test="recharge-price" type="text" inputmode="decimal" @change="normalizeNumber('price', 0.01, 2)" /><span class="spinner-stack"><button class="spinner-button" data-test="increase-recharge-price" type="button" aria-label="提高价格" @click="adjustNumber('price', 1, 0.01, 2)">▲</button><button class="spinner-button" data-test="decrease-recharge-price" type="button" aria-label="降低价格" @click="adjustNumber('price', -1, 0.01, 2)">▼</button></span></div></label>
                <label><span>展示顺序</span><div class="numeric-control"><input v-model.number="draft.sortOrder" data-test="recharge-sort-order" type="text" inputmode="numeric" @change="normalizeNumber('sortOrder', 0, 0)" /><span class="spinner-stack"><button class="spinner-button" data-test="increase-recharge-sort-order" type="button" aria-label="增大展示顺序" @click="adjustNumber('sortOrder', 1, 0, 0)">▲</button><button class="spinner-button" data-test="decrease-recharge-sort-order" type="button" aria-label="减小展示顺序" @click="adjustNumber('sortOrder', -1, 0, 0)">▼</button></span></div><small class="field-hint">数字越小越靠前</small></label>
              </div>
              <label><span>商品说明</span><textarea v-model.trim="draft.description" data-test="recharge-description" rows="3" placeholder="说明玩家支付后会获得什么" /></label>
            </section>

            <section class="form-section">
              <h4>权益配置</h4>
              <label><span>权益类型</span><select v-model="draft.benefitType" data-test="recharge-benefit-type"><option value="coins">金币</option><option value="energy">能量</option><option value="item">游戏道具</option><option value="permanent-free-entry">永久免能量开局</option><option value="custom">自定义权益</option></select></label>
              <label v-if="needsBenefitName"><span>{{ draft.benefitType === 'item' ? '道具名称 / 标识' : '权益名称 / 标识' }}</span><input v-model.trim="draft.benefitName" data-test="recharge-benefit-name" placeholder="后端发放时使用的权益标识" /></label>
              <label v-if="showsBenefitAmount"><span>权益数量</span><div class="numeric-control"><input v-model.number="draft.benefitAmount" data-test="recharge-benefit-amount" type="text" inputmode="numeric" @change="normalizeNumber('benefitAmount', 1, 0)" /><span class="spinner-stack"><button class="spinner-button" data-test="increase-recharge-benefit-amount" type="button" aria-label="增加权益数量" @click="adjustNumber('benefitAmount', 1, 1, 0)">▲</button><button class="spinner-button" data-test="decrease-recharge-benefit-amount" type="button" aria-label="减少权益数量" @click="adjustNumber('benefitAmount', -1, 1, 0)">▼</button></span></div></label>
              <p v-else class="permanent-hint">永久权益不需要填写数量，支付确认后只发放一次永久资格。</p>
            </section>

            <section class="form-section payment-section">
              <h4>收款设置</h4>
              <label class="upload-zone">
                <input data-test="recharge-qr-file" type="file" accept="image/png,image/jpeg,image/webp" @change="handleQrFile" />
                <span class="upload-icon">▣</span><strong>{{ draft.qrCodeImage ? '更换收款二维码' : '上传收款二维码' }}</strong><small>支持 PNG、JPG、WebP</small>
              </label>
              <div v-if="draft.qrCodeImage" class="qr-preview-row"><img :src="draft.qrCodeImage" class="qr-preview" data-test="recharge-qr-preview" alt="二维码预览" /><span>二维码将在玩家创建订单后展示，订单有效期 10 分钟。</span></div>
            </section>

            <p v-if="errorMessage" class="form-error" data-test="recharge-form-error" role="alert">{{ errorMessage }}</p>
            <p v-if="feedback" class="form-feedback" role="status">{{ feedback }}</p>
          </div>

          <footer class="drawer-footer"><button class="cancel-action" type="button" @click="closeDrawer">取消</button><button class="primary-action" data-test="save-recharge-product" type="button" @click="saveProduct">保存商品</button></footer>
        </form>
      </aside>
    </div>
  </section>
</template>

<script>
import { apiClient } from '../services/api.js'

function emptyDraft() {
  return {
    id: '', name: '', price: 1, benefitType: 'coins', benefitAmount: 1000,
    benefitName: '', description: '', enabled: true, sortOrder: 10, qrCodeImage: '',
  }
}

export default {
  name: 'AdminRechargeProducts',
  props: {
    loader: { type: Function, default: () => apiClient.getAdminRechargeProducts() },
    saver: { type: Function, default: (product) => apiClient.saveAdminRechargeProduct(product) },
    readerFactory: { type: Function, default: () => new FileReader() },
  },
  data() {
    return { products: [], draft: emptyDraft(), drawerOpen: false, errorMessage: '', feedback: '' }
  },
  computed: {
    showsBenefitAmount() { return this.draft.benefitType !== 'permanent-free-entry' },
    needsBenefitName() { return ['item', 'custom'].includes(this.draft.benefitType) },
  },
  async mounted() { await this.reload() },
  methods: {
    async reload() { this.products = await this.loader() },
    resetDraft() { this.draft = emptyDraft(); this.errorMessage = ''; this.feedback = ''; this.drawerOpen = true },
    editProduct(product) { this.draft = { benefitName: '', ...product }; this.errorMessage = ''; this.feedback = ''; this.drawerOpen = true },
    async toggleProduct(product) {
      const saved = await this.saver({ ...product, enabled: !product.enabled })
      Object.assign(product, saved)
    },
    closeDrawer() { this.drawerOpen = false; this.errorMessage = ''; this.feedback = '' },
    formatNumber(value) { return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) },
    benefitLabel(product) {
      const amount = Math.max(1, Number(product.benefitAmount) || 1)
      if (product.benefitType === 'coins') return `${amount} 金币`
      if (product.benefitType === 'energy') return `${amount} 格能量`
      if (product.benefitType === 'item') return `${product.benefitName || '游戏道具'} ×${amount}`
      if (product.benefitType === 'custom') return `${product.benefitName || '自定义权益'} ×${amount}`
      return '永久免能量开局'
    },
    adjustNumber(field, delta, minimum, precision) {
      const current = Number(this.draft[field]) || 0
      const next = Math.max(minimum, current + delta)
      this.draft[field] = precision ? Number(next.toFixed(precision)) : Math.round(next)
    },
    normalizeNumber(field, minimum, precision) {
      const value = Math.max(minimum, Number(this.draft[field]) || minimum)
      this.draft[field] = precision ? Number(value.toFixed(precision)) : Math.round(value)
    },
    handleQrFile(event) {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = this.readerFactory()
      reader.onload = () => { this.draft.qrCodeImage = reader.result }
      reader.onerror = () => { this.errorMessage = '二维码读取失败，请重新选择图片' }
      reader.readAsDataURL(file)
    },
    async saveProduct() {
      this.errorMessage = ''
      this.feedback = ''
      try {
        const payload = {
          ...this.draft,
          benefitAmount: this.showsBenefitAmount ? this.draft.benefitAmount : 1,
          benefitName: this.needsBenefitName ? this.draft.benefitName : '',
        }
        const saved = await this.saver(payload)
        this.feedback = `${saved.name} 已保存`
        await this.reload()
        this.draft = { benefitName: '', ...saved }
        this.drawerOpen = false
      } catch (error) {
        this.errorMessage = error?.message || '商品保存失败'
      }
    },
  },
}
</script>

<style scoped>
.recharge-admin { min-height: 560px; padding: 22px; border: 1px solid #263c5c; background: #0d1727; }.recharge-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }.recharge-admin h2, .recharge-admin h3, .recharge-admin h4 { margin: 0; }.recharge-admin h2 { font-size: 16px; }.recharge-header p { margin: 5px 0 0; color: #8297b5; font-size: 10px; }.secondary-action { min-height: 34px; padding: 0 13px; border: 1px solid #8e7133; border-radius: 4px; background: #4b391d; color: #f2d376; cursor: pointer; }.product-table-wrap { min-height: 450px; overflow-x: auto; border: 1px solid #203650; background: #0a1321; }.product-table { width: 100%; border-collapse: collapse; font-size: 11px; }.product-table th, .product-table td { padding: 14px 13px; text-align: left; }.product-table th { color: #7f94b1; font-size: 10px; font-weight: 500; }.product-table td { border-top: 1px solid #20344e; color: #b9c8da; }.product-table td strong, .product-table td small { display: block; }.product-table td strong { color: #e4ebf5; }.product-table td small { max-width: 320px; margin-top: 4px; overflow: hidden; color: #7187a5; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.product-price { color: #e5c66d !important; font-weight: 700; }.product-state { display: inline-block; padding: 4px 7px; border-radius: 3px; background: #3b2227; color: #e5969c; font-size: 9px; }.product-state.enabled { background: #173a2c; color: #76d29a; }.row-action { min-height: 29px; padding: 0 10px; border: 1px solid #455d7a; border-radius: 3px; background: #14243b; color: #c9d7e8; cursor: pointer; }.empty-state { padding: 70px 20px !important; color: #7187a5 !important; text-align: center !important; }.drawer-backdrop { position: fixed; inset: 0; z-index: 40; background: #02050bb8; }.product-drawer { position: absolute; top: 0; right: 0; display: grid; width: min(520px, 100%); height: 100%; grid-template-rows: auto minmax(0, 1fr); border-left: 1px solid #8d7134; background: #0b1422; box-shadow: -24px 0 70px #0009; }.drawer-header { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 15px; padding: 20px 22px; border-bottom: 1px solid #263b58; }.drawer-header small { color: #c7a854; font-size: 9px; letter-spacing: 1.5px; }.drawer-header h3 { margin-top: 5px; font-size: 18px; }.drawer-close { width: 32px; height: 32px; border: 1px solid #344d6d; border-radius: 4px; background: #111e31; color: #aebdd1; font-size: 20px; cursor: pointer; }.enabled-switch { display: inline-flex; align-items: center; gap: 7px; color: #9eb0c8; font-size: 10px; cursor: pointer; }.enabled-switch input { position: absolute; opacity: 0; pointer-events: none; }.enabled-switch > span { position: relative; width: 31px; height: 17px; border: 1px solid #52647e; border-radius: 9px; background: #111b2b; }.enabled-switch i { position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; border-radius: 50%; background: #8290a6; transition: 160ms ease; }.enabled-switch input:checked + span { border-color: #b9943e; background: #403117; }.enabled-switch input:checked + span i { left: 16px; background: #f0cb6d; }.product-form { display: grid; min-height: 0; grid-template-rows: minmax(0, 1fr) auto; }.drawer-body { overflow-y: auto; padding: 20px 22px; }.form-section + .form-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid #223650; }.form-section h4 { margin-bottom: 13px; color: #e5c66d; font-size: 12px; }.form-section label { display: grid; gap: 6px; margin-bottom: 12px; color: #91a5c0; font-size: 10px; }.field-hint { margin-top: -2px; color: #617793; font-size: 9px; }.form-section input, .form-section select, .form-section textarea { box-sizing: border-box; width: 100%; min-height: 38px; padding: 8px 10px; border: 1px solid #344e70; border-radius: 3px; outline: none; background: #101d30; color: #e6edf7; font: inherit; }.form-section input:focus, .form-section select:focus, .form-section textarea:focus { border-color: #b99748; }.form-section textarea { resize: vertical; line-height: 1.55; }.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.numeric-control { display: grid; grid-template-columns: minmax(0, 1fr) 24px; overflow: hidden; border: 1px solid #344e70; border-radius: 3px; background: #101d30; }.numeric-control:focus-within { border-color: #b99748; }.numeric-control > input { min-width: 0; border: 0; border-radius: 0; background: transparent; }.spinner-stack { display: grid; grid-template-rows: 1fr 1fr; border-left: 1px solid #344e70; background: #070c14; }.spinner-button { min-width: 24px; min-height: 18px; padding: 0; border: 0; background: #070c14; color: #899bb4; font-size: 7px; line-height: 1; cursor: pointer; }.spinner-button + .spinner-button { border-top: 1px solid #263a53; }.spinner-button:hover { background: #17243a; color: #e5c66d; }.permanent-hint { margin: 0; padding: 11px 12px; border-left: 2px solid #9b7c36; background: #191a18; color: #8296b1; font-size: 10px; line-height: 1.6; }.upload-zone { min-height: 108px; place-items: center; align-content: center; gap: 5px !important; border: 1px dashed #536984; border-radius: 4px; background: #0d192a; text-align: center; cursor: pointer; }.upload-zone input { position: absolute; width: 1px; min-height: 1px; opacity: 0; }.upload-icon { color: #d0ad54; font-size: 23px; }.upload-zone strong { color: #dce6f2; font-size: 11px; }.upload-zone small { color: #6f85a2; font-size: 9px; }.qr-preview-row { display: grid; grid-template-columns: 92px minmax(0, 1fr); align-items: center; gap: 13px; }.qr-preview { width: 82px; aspect-ratio: 1; object-fit: contain; border: 5px solid #fff; background: #fff; }.qr-preview-row span { color: #7f94af; font-size: 10px; line-height: 1.6; }.form-error, .form-feedback { margin: 16px 0 0; font-size: 10px; }.form-error { color: #e99a9e; }.form-feedback { color: #79cc9a; }.drawer-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 16px 22px; border-top: 1px solid #263b58; background: #0a121f; }.drawer-footer button { min-height: 40px; border-radius: 4px; font-weight: 700; cursor: pointer; }.cancel-action { border: 1px solid #3b506d; background: #111e31; color: #b9c8da; }.primary-action { border: 1px solid #c59d43; background: #8a6528; color: #fff0b1; }
@media (max-width: 720px) { .recharge-admin { padding: 14px; }.product-table th:nth-child(4), .product-table td:nth-child(4) { display: none; }.form-row { grid-template-columns: 1fr; }.drawer-header { padding: 16px; }.drawer-body, .drawer-footer { padding-right: 16px; padding-left: 16px; } }
.row-actions { display: flex; justify-content: flex-end; gap: 6px; }
.drawer-header { grid-template-columns: minmax(0, 1fr) auto; }
</style>
