<template>
  <section class="notification-admin" data-test="admin-notification-publisher">
    <header class="notification-admin-header">
      <div><h2>通知发布</h2><p>向全体玩家广播，或搜索并勾选指定玩家发送</p></div>
      <button class="publish-entry" data-test="open-notification-publisher" type="button" @click="openPublisher">发布通知</button>
    </header>

    <section class="notification-summary" aria-label="通知概况">
      <div><small>累计发布</small><strong>{{ publications.length }}</strong></div>
      <div><small>最近触达</small><strong>{{ publications[0]?.recipientCount || 0 }}</strong></div>
      <div><small>最近阅读率</small><strong>{{ readRate(publications[0]) }}</strong></div>
    </section>

    <div class="notification-history" data-test="notification-history">
      <table>
        <thead><tr><th>通知</th><th>发送范围</th><th>触达 / 已读</th><th>发布时间</th><th>状态</th></tr></thead>
        <tbody>
          <tr v-for="item in publications" :key="item.id">
            <td><strong>{{ item.title }}</strong><small>{{ item.content }}</small></td>
            <td>{{ item.audienceLabel }}</td>
            <td>{{ item.recipientCount }} / {{ item.readCount }}</td>
            <td>{{ item.sentAt }}</td>
            <td><span class="sent-status">已发布</span></td>
          </tr>
          <tr v-if="!loading && publications.length === 0"><td colspan="5" class="empty-history">还没有发布记录</td></tr>
        </tbody>
      </table>
      <p v-if="loading" class="history-state">正在加载发布记录...</p>
    </div>

    <div v-if="drawerOpen" class="drawer-backdrop" @click.self="closePublisher">
      <aside class="publisher-drawer" aria-label="发布通知">
        <header><div><small>NEW MESSAGE</small><h3>发布通知</h3></div><button class="drawer-close" type="button" aria-label="关闭" @click="closePublisher">×</button></header>
        <div class="drawer-body">
          <section class="form-section">
            <h4>通知内容</h4>
            <label><span>通知类型</span><select v-model="draft.type" data-test="notification-type"><option value="notice">运营通知</option><option value="system">系统通知</option><option value="reward">活动奖励</option></select></label>
            <label><span>标题</span><input v-model.trim="draft.title" data-test="notification-title" maxlength="40" placeholder="请输入通知标题" /></label>
            <label><span>正文</span><textarea v-model.trim="draft.content" data-test="notification-content" maxlength="500" rows="6" placeholder="请输入玩家看到的完整内容" /></label>
          </section>

          <section class="form-section">
            <h4>发送范围</h4>
            <div class="audience-tabs" role="group" aria-label="发送范围">
              <button data-test="audience-all" :class="{ active: draft.audienceType === 'all' }" type="button" @click="setAudience('all')">全体玩家</button>
              <button data-test="audience-selected" :class="{ active: draft.audienceType === 'selected' }" type="button" @click="setAudience('selected')">指定玩家</button>
            </div>
            <div v-if="draft.audienceType === 'selected'" class="recipient-picker">
              <div class="recipient-search-row"><input v-model.trim="recipientSearch" data-test="recipient-search" placeholder="搜索用户名" /><strong>已选 {{ draft.recipientIds.length }}</strong></div>
              <div class="recipient-list">
                <label v-for="player in filteredPlayers" :key="player.id" class="recipient-row">
                  <input v-model="draft.recipientIds" :data-test="`recipient-${player.id}`" type="checkbox" :value="player.id" />
                  <span><strong>{{ player.username }}</strong><small>#{{ player.id }} · {{ player.enabled ? '正常' : '已停用' }}</small></span>
                </label>
                <p v-if="filteredPlayers.length === 0">没有匹配的玩家</p>
              </div>
            </div>
            <p v-else class="broadcast-hint">将向所有可接收通知的玩家发布，提交前会再次确认。</p>
          </section>

          <p v-if="errorMessage" class="publish-error" data-test="notification-publish-error" role="alert">{{ errorMessage }}</p>
        </div>
        <footer><button class="drawer-cancel" type="button" @click="closePublisher">取消</button><button class="drawer-submit" data-test="submit-notification" type="button" :disabled="busy" @click="requestPublish">{{ busy ? '发布中...' : '发布通知' }}</button></footer>
      </aside>
    </div>

    <div v-if="broadcastConfirmation" class="confirm-backdrop" data-test="broadcast-confirmation">
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-label="确认全体发布">
        <span class="confirm-mark">!</span><h3>确认发送给全体玩家？</h3><p>通知发布后会进入所有玩家的通知中心，请确认标题和正文无误。</p>
        <div><button type="button" @click="broadcastConfirmation = false">返回检查</button><button data-test="confirm-broadcast" type="button" @click="performPublish">确认发布</button></div>
      </section>
    </div>
  </section>
</template>

<script>
import { apiClient } from '../services/api.js'

function emptyDraft() {
  return { type: 'notice', title: '', content: '', audienceType: 'all', recipientIds: [] }
}

export default {
  name: 'AdminNotificationPublisher',
  props: {
    players: { type: Array, default: () => [] },
    loader: { type: Function, default: () => apiClient.getAdminNotificationPublications() },
    publisher: { type: Function, default: (payload) => apiClient.publishAdminNotification(payload) },
  },
  data() {
    return { publications: [], loading: true, drawerOpen: false, broadcastConfirmation: false, busy: false, recipientSearch: '', errorMessage: '', draft: emptyDraft() }
  },
  computed: {
    filteredPlayers() {
      const keyword = this.recipientSearch.toLowerCase()
      return this.players.filter((player) => !keyword || player.username.toLowerCase().includes(keyword))
    },
  },
  async mounted() { await this.reload() },
  methods: {
    async reload() {
      this.loading = true
      try {
        const result = await this.loader()
        this.publications = Array.isArray(result) ? result : (result?.items || [])
      } catch (error) {
        this.errorMessage = error?.message || '通知列表刷新失败，已保留上次数据'
      } finally { this.loading = false }
    },
    readRate(item) {
      if (!item?.recipientCount) return '0%'
      return `${Math.round((item.readCount / item.recipientCount) * 100)}%`
    },
    openPublisher() { this.draft = emptyDraft(); this.recipientSearch = ''; this.errorMessage = ''; this.drawerOpen = true },
    closePublisher() { if (this.busy) return; this.drawerOpen = false; this.broadcastConfirmation = false },
    setAudience(type) { this.draft.audienceType = type; this.errorMessage = '' },
    requestPublish() {
      this.errorMessage = ''
      if (!this.draft.title) this.errorMessage = '请输入通知标题'
      else if (!this.draft.content) this.errorMessage = '请输入通知内容'
      else if (this.draft.audienceType === 'selected' && this.draft.recipientIds.length === 0) this.errorMessage = '请至少选择一名玩家'
      if (this.errorMessage) return
      if (this.draft.audienceType === 'all') this.broadcastConfirmation = true
      else this.performPublish()
    },
    async performPublish() {
      this.broadcastConfirmation = false
      this.busy = true
      this.errorMessage = ''
      const selected = this.players.filter((player) => this.draft.recipientIds.includes(player.id))
      try {
        await this.publisher({
          ...this.draft,
          recipientIds: this.draft.audienceType === 'selected' ? [...this.draft.recipientIds] : [],
          recipientNames: this.draft.audienceType === 'selected' ? selected.map((player) => player.username) : [],
        })
        await this.reload()
        this.drawerOpen = false
      } catch (error) {
        this.errorMessage = error?.message || '通知发布失败，请稍后重试'
      } finally {
        this.busy = false
      }
    },
  },
}
</script>

<style scoped>
.notification-admin { min-height: 560px; padding: 22px; border: 1px solid #263c5c; background: #0d1727; color: #eaf0fa; }.notification-admin-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }.notification-admin h2, .notification-admin h3, .notification-admin h4 { margin: 0; }.notification-admin-header h2 { font-size: 16px; }.notification-admin-header p { margin: 5px 0 0; color: #8297b5; font-size: 10px; }.publish-entry { min-height: 34px; padding: 0 14px; border: 1px solid #a08039; border-radius: 4px; background: #4d3a1d; color: #f4d779; cursor: pointer; }.notification-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 20px 0 14px; border: 1px solid #203650; background: #0a1321; }.notification-summary div { padding: 15px 18px; border-right: 1px solid #203650; }.notification-summary div:last-child { border-right: 0; }.notification-summary small, .notification-summary strong { display: block; }.notification-summary small { color: #7d92af; font-size: 10px; }.notification-summary strong { margin-top: 6px; color: #e5c66d; font-size: 20px; }.notification-history { min-height: 360px; overflow-x: auto; border: 1px solid #203650; background: #0a1321; }.notification-history table { width: 100%; border-collapse: collapse; font-size: 11px; }.notification-history th, .notification-history td { padding: 13px 14px; text-align: left; }.notification-history th { color: #7d92af; font-size: 10px; font-weight: 500; }.notification-history td { border-top: 1px solid #20344e; color: #b9c8da; }.notification-history td strong, .notification-history td small { display: block; }.notification-history td strong { color: #e4ebf5; }.notification-history td small { max-width: 360px; margin-top: 4px; overflow: hidden; color: #738aa9; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.sent-status { padding: 4px 7px; border-radius: 3px; background: #173a2c; color: #76d29a; font-size: 9px; }.empty-history, .history-state { color: #7287a5; text-align: center !important; }.drawer-backdrop, .confirm-backdrop { position: fixed; inset: 0; z-index: 40; background: #02050bb8; }.publisher-drawer { position: absolute; top: 0; right: 0; display: grid; width: min(470px, 100%); height: 100%; grid-template-rows: auto minmax(0, 1fr) auto; border-left: 1px solid #8d7134; background: #0b1422; box-shadow: -24px 0 70px #0009; }.publisher-drawer > header { display: flex; align-items: center; justify-content: space-between; padding: 20px 22px; border-bottom: 1px solid #263b58; }.publisher-drawer > header small { color: #c7a854; font-size: 9px; letter-spacing: 1.5px; }.publisher-drawer > header h3 { margin-top: 5px; font-size: 18px; }.drawer-close { width: 32px; height: 32px; border: 1px solid #344d6d; border-radius: 4px; background: #111e31; color: #aebdd1; font-size: 20px; cursor: pointer; }.drawer-body { overflow-y: auto; padding: 20px 22px; }.form-section + .form-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid #223650; }.form-section h4 { margin-bottom: 13px; color: #e5c66d; font-size: 12px; }.form-section label { display: grid; gap: 6px; margin-bottom: 12px; color: #91a5c0; font-size: 10px; }.form-section input, .form-section select, .form-section textarea { box-sizing: border-box; width: 100%; min-height: 38px; padding: 8px 10px; border: 1px solid #344e70; border-radius: 3px; outline: none; background: #101d30; color: #e6edf7; font: inherit; }.form-section input:focus, .form-section select:focus, .form-section textarea:focus { border-color: #b99748; }.form-section textarea { resize: vertical; line-height: 1.55; }.audience-tabs { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 13px; }.audience-tabs button { min-height: 36px; border: 1px solid #344e70; background: #101d30; color: #94a8c3; font-size: 14px; cursor: pointer; }.audience-tabs button:first-child { border-radius: 4px 0 0 4px; }.audience-tabs button:last-child { border-radius: 0 4px 4px 0; }.audience-tabs button.active { border-color: #a78841; background: #332a19; color: #f0d47e; }.recipient-search-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; }.recipient-search-row strong { color: #d7bd70; font-size: 10px; }.recipient-list { max-height: 210px; margin-top: 9px; overflow-y: auto; border: 1px solid #263c5a; }.recipient-row { display: grid !important; grid-template-columns: 16px minmax(0, 1fr); align-items: center; gap: 9px !important; margin: 0 !important; padding: 10px 11px; border-bottom: 1px solid #20344e; cursor: pointer; }.recipient-row:last-child { border-bottom: 0; }.recipient-row input { width: 14px; min-height: 14px; accent-color: #c7a34e; }.recipient-row span strong, .recipient-row span small { display: block; }.recipient-row span strong { color: #dce6f3; font-size: 11px; }.recipient-row span small { margin-top: 3px; color: #7187a5; font-size: 9px; }.recipient-list > p, .broadcast-hint { margin: 0; padding: 13px; color: #7f94b1; font-size: 10px; line-height: 1.6; }.broadcast-hint { border-left: 2px solid #9b7c36; background: #191a18; }.publish-error { margin: 16px 0 0; color: #e99a9e; font-size: 10px; }.publisher-drawer > footer { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 16px 22px; border-top: 1px solid #263b58; background: #0a121f; }.publisher-drawer > footer button { min-height: 40px; border-radius: 4px; font-weight: 700; cursor: pointer; }.drawer-cancel { border: 1px solid #3b506d; background: #111e31; color: #b9c8da; }.drawer-submit { border: 1px solid #c59d43; background: #8a6528; color: #fff0b1; }.confirm-backdrop { z-index: 60; display: grid; place-items: center; padding: 20px; }.confirm-dialog { width: min(390px, 100%); padding: 26px; border: 1px solid #8d7134; background: #0d1727; box-shadow: 0 24px 80px #000c; text-align: center; }.confirm-mark { display: grid; width: 38px; height: 38px; margin: 0 auto 13px; place-items: center; border: 1px solid #b48d3c; border-radius: 50%; color: #f0cc6d; font-weight: 800; }.confirm-dialog p { color: #91a4bf; font-size: 11px; line-height: 1.7; }.confirm-dialog > div { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 18px; }.confirm-dialog button { min-height: 38px; border: 1px solid #435a78; border-radius: 4px; background: #14243a; color: #c8d5e6; cursor: pointer; }.confirm-dialog button:last-child { border-color: #b28b3b; background: #6d5122; color: #ffe595; }
@media (max-width: 720px) { .notification-admin { padding: 14px; }.notification-summary { grid-template-columns: 1fr; }.notification-summary div { border-right: 0; border-bottom: 1px solid #203650; }.notification-summary div:last-child { border-bottom: 0; }.notification-history th:nth-child(3), .notification-history td:nth-child(3) { display: none; } }
</style>
