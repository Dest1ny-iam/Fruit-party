<template>
  <section class="permission-center" data-test="admin-permission-center">
    <header class="permission-heading">
      <div>
        <p>PLAYER ACCESS</p>
        <h2>特殊权限中心</h2>
      </div>
      <form class="permission-search" @submit.prevent="searchPlayers">
        <input v-model="searchInput" data-test="permission-search" placeholder="模糊搜索玩家" aria-label="搜索玩家" />
        <button data-test="permission-search-submit" type="button" @click="searchPlayers">查询</button>
      </form>
    </header>

    <p v-if="feedback" :class="['permission-feedback', { error: feedbackIsError }]" data-test="permission-feedback">{{ feedback }}</p>

    <div class="permission-table-wrap">
      <table>
        <thead><tr><th>玩家</th><th>注册日期</th><th>金币</th><th>能量权限</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="player in players" :key="player.id" :data-test="`permission-row-${player.id}`">
            <td data-label="玩家"><strong>{{ player.username }}</strong><small>#{{ player.id }}</small></td>
            <td data-label="注册日期">{{ player.joined }}</td>
            <td data-label="金币">{{ formatCoins(player.coins) }}</td>
            <td data-label="能量权限"><span :class="['permission-status', { granted: player.infiniteEnergy }]">{{ player.infiniteEnergy ? '无限能量' : '普通能量' }}</span></td>
            <td data-label="操作">
              <div class="permission-actions">
                <button
                  :data-test="`permission-toggle-${player.id}`"
                  :class="['permission-button', player.infiniteEnergy ? 'permission-button--revoke' : 'permission-button--grant']"
                  type="button"
                  :disabled="busy"
                  @click="openPermissionDialog(player)"
                >
                  {{ player.infiniteEnergy ? '撤销特殊权限' : '授予特殊权限' }}
                </button>
                <button :data-test="`grant-coins-${player.id}`" class="coin-button" type="button" :disabled="busy" @click="grantCoins(player)">赠送 1000 金币</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && players.length === 0"><td class="empty-state" colspan="5">没有匹配的玩家</td></tr>
        </tbody>
      </table>
    </div>

    <footer class="permission-pagination pagination--fixed" data-test="permissions-pagination">
      <span>第 {{ page }} / {{ pageCount }} 页 · {{ total }} 名玩家</span>
      <div><button data-test="permissions-previous" type="button" :disabled="loading || page <= 1" @click="changePage(page - 1)">上一页</button><button data-test="permissions-next" type="button" :disabled="loading || page >= pageCount" @click="changePage(page + 1)">下一页</button></div>
    </footer>

    <div v-if="dialogPlayer" class="dialog-backdrop" data-test="admin-password-dialog" @click.self="closePermissionDialog">
      <form class="password-dialog" @submit.prevent="confirmPermissionChange">
        <p>SECURITY CONFIRMATION</p>
        <h3>{{ dialogPlayer.infiniteEnergy ? '撤销特殊权限' : '授予特殊权限' }}</h3>
        <span>目标玩家：{{ dialogPlayer.username }}</span>
        <label>管理员密码<input v-model="adminPassword" data-test="permission-admin-password" type="password" autocomplete="current-password" required /></label>
        <small v-if="dialogError" class="dialog-error">{{ dialogError }}</small>
        <div class="dialog-actions"><button type="button" :disabled="busy" @click="closePermissionDialog">取消</button><button data-test="confirm-permission-change" class="confirm-button" type="button" :disabled="busy || !adminPassword" @click="confirmPermissionChange">{{ busy ? '处理中...' : '确认' }}</button></div>
      </form>
    </div>
  </section>
</template>

<script>
import { apiClient } from '../services/api.js'

export default {
  name: 'AdminPermissionCenter',
  props: {
    loader: { type: Function, default: () => apiClient.getAdminPermissions() },
    permissionUpdater: { type: Function, default: (playerId, payload) => apiClient.updateAdminInfiniteEnergy(playerId, payload) },
    coinGranter: { type: Function, default: (playerId, payload) => apiClient.grantAdminCoins(playerId, payload) },
    operationIdFactory: {
      type: Function,
      default: () => globalThis.crypto?.randomUUID?.() || `grant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    },
  },
  data() {
    return {
      players: [], page: 1, pageSize: 6, total: 0, keyword: '', searchInput: '',
      loading: false, busy: false, feedback: '', feedbackIsError: false,
      dialogPlayer: null, adminPassword: '', dialogError: '',
    }
  },
  computed: {
    pageCount() { return Math.max(1, Math.ceil(this.total / this.pageSize)) },
  },
  created() { this.loadPlayers() },
  methods: {
    formatCoins(value) { return Number(value || 0).toLocaleString('zh-CN') },
    async loadPlayers() {
      this.loading = true
      try {
        const result = await this.loader({ page: this.page, pageSize: this.pageSize, keyword: this.keyword })
        this.players = result.items.map((player) => ({ ...player }))
        this.page = result.page
        this.total = result.total
      } finally {
        this.loading = false
      }
    },
    searchPlayers() {
      this.keyword = this.searchInput.trim()
      this.page = 1
      return this.loadPlayers()
    },
    changePage(page) {
      this.page = page
      return this.loadPlayers()
    },
    openPermissionDialog(player) {
      this.dialogPlayer = player
      this.adminPassword = ''
      this.dialogError = ''
    },
    closePermissionDialog() {
      if (this.busy) return
      this.dialogPlayer = null
    },
    async confirmPermissionChange() {
      if (!this.dialogPlayer || this.busy) return
      this.busy = true
      this.dialogError = ''
      const enabled = !this.dialogPlayer.infiniteEnergy
      try {
        const updated = await this.permissionUpdater(this.dialogPlayer.id, { enabled, adminPassword: this.adminPassword })
        Object.assign(this.dialogPlayer, updated)
        this.feedback = enabled ? `已授予 ${updated.username} 无限能量` : `已撤销 ${updated.username} 的无限能量`
        this.feedbackIsError = false
        this.dialogPlayer = null
      } catch (error) {
        this.dialogError = error?.code === 'INVALID_ADMIN_PASSWORD' ? '管理员密码错误' : (error?.message || '操作失败')
      } finally {
        this.busy = false
      }
    },
    async grantCoins(player) {
      if (this.busy) return
      this.busy = true
      try {
        const updated = await this.coinGranter(player.id, { operationId: this.operationIdFactory() })
        Object.assign(player, updated)
        this.feedback = `已向 ${player.username} 赠送 1000 金币`
        this.feedbackIsError = false
      } catch (error) {
        this.feedback = error?.message || '赠送失败'
        this.feedbackIsError = true
      } finally {
        this.busy = false
      }
    },
  },
}
</script>

<style scoped>
.permission-center { display: flex; min-height: 540px; flex-direction: column; padding: 22px; border: 1px solid #263c5c; background: #0d1727; color: #eaf0fa; }
.permission-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 20px; }.permission-heading p { margin: 0 0 6px; color: #c4a955; font-size: 9px; letter-spacing: 1.5px; }.permission-heading h2 { margin: 0 0 6px; font-size: 17px; }.permission-heading span { color: #8196b4; font-size: 10px; }
.permission-search { display: flex; min-width: 270px; gap: 7px; }.permission-search input { min-width: 0; min-height: 34px; flex: 1; box-sizing: border-box; padding: 0 10px; border: 1px solid #344e70; background: #0a1321; color: #e1eaf6; }.permission-search button { min-height: 34px; padding: 0 12px; border: 1px solid #3b5677; background: #14243b; color: #cbd9eb; cursor: pointer; }
.permission-feedback { margin: 0 0 12px; padding: 9px 11px; border-left: 2px solid #63b982; background: #11291f; color: #91d8aa; font-size: 10px; }.permission-feedback.error { border-color: #c8666f; background: #321b21; color: #ef9aa2; }
.permission-table-wrap { min-height: 378px; flex: 1; overflow-x: auto; }.permission-table-wrap table { width: 100%; border-collapse: collapse; font-size: 11px; }.permission-table-wrap th { padding: 11px 10px; color: #8196b5; font-size: 10px; font-weight: 500; text-align: left; }.permission-table-wrap td { padding: 14px 10px; border-top: 1px solid #20344e; color: #b9c8da; }.permission-table-wrap td strong, .permission-table-wrap td small { display: block; }.permission-table-wrap td strong { color: #e7eef8; }.permission-table-wrap td small { margin-top: 3px; color: #7087a6; font-size: 9px; }
.permission-status { display: inline-block; min-width: 62px; padding: 5px 7px; border: 1px solid #354c69; background: #111d2e; color: #8fa3be; font-size: 9px; text-align: center; }.permission-status.granted { border-color: #806b2d; background: #2c2514; color: #eed175; }
.permission-actions { display: flex; flex-wrap: wrap; justify-content: end; gap: 6px; }.permission-button, .coin-button { min-height: 30px; padding: 0 9px; font-size: 10px; cursor: pointer; }.permission-button--grant { border: 1px solid #386d5c; background: #142c27; color: #91d2ba; }.permission-button--revoke { border: 1px solid #74464d; background: #301c22; color: #e6a0a7; }.coin-button { border: 1px solid #315e54; background: #122a27; color: #86cdb7; }button:disabled { opacity: .42; cursor: not-allowed; }.empty-state { padding: 70px 10px !important; text-align: center; }
.permission-pagination { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: auto; color: #8196b4; font-size: 10px; }.permission-pagination div { display: flex; gap: 7px; }.pagination--fixed { min-height: 34px; padding-top: 18px; box-sizing: border-box; }.pagination--fixed button { min-width: 56px; min-height: 34px; padding: 0 9px; border: 1px solid #385475; background: #122137; color: #d5e2f4; font-size: 10px; cursor: pointer; }.pagination--fixed button:hover:not(:disabled) { border-color: #52749c; background: #172b46; }.pagination--fixed button:disabled { border-color: #243750; background: #0e1827; color: #657890; opacity: 1; cursor: not-allowed; }
.dialog-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 18px; background: #02050bcc; }.password-dialog { width: min(380px, 100%); box-sizing: border-box; padding: 24px; border: 1px solid #405879; background: #0b1525; box-shadow: 0 24px 70px #000b; }.password-dialog > p { margin: 0 0 7px; color: #c8ad57; font-size: 9px; letter-spacing: 1.4px; }.password-dialog h3 { margin: 0 0 7px; font-size: 18px; }.password-dialog > span { color: #8ea2bd; font-size: 11px; }.password-dialog label { display: grid; gap: 6px; margin-top: 20px; color: #a9b9ce; font-size: 10px; }.password-dialog input { min-height: 38px; box-sizing: border-box; padding: 0 10px; border: 1px solid #395271; background: #070f1c; color: #edf3fb; }.dialog-error { display: block; margin-top: 8px; color: #ee8e98; }.dialog-actions { display: flex; justify-content: end; gap: 8px; margin-top: 20px; }.dialog-actions button { min-height: 34px; padding: 0 13px; border: 1px solid #39516f; background: #142239; color: #c9d6e7; }.dialog-actions .confirm-button { border-color: #8c7132; background: #765724; color: #fff0b0; }
@media (max-width: 760px) { .permission-center { min-height: 620px; padding: 15px; }.permission-heading { align-items: stretch; flex-direction: column; }.permission-search { min-width: 0; width: 100%; }.permission-table-wrap { min-height: 420px; overflow: visible; }.permission-table-wrap table { min-width: 0; }.permission-table-wrap thead { display: none; }.permission-table-wrap tbody { display: grid; gap: 10px; }.permission-table-wrap tr { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 13px; border: 1px solid #263d5b; background: #0a1423; }.permission-table-wrap td { min-width: 0; padding: 0; border: 0; }.permission-table-wrap td::before { display: block; margin-bottom: 5px; color: #7189a8; content: attr(data-label); font-size: 8px; }.permission-table-wrap td:first-child, .permission-table-wrap td:last-child, .permission-table-wrap .empty-state { grid-column: 1 / -1; }.permission-actions { justify-content: start; }.permission-pagination { align-items: flex-start; flex-direction: column; } }
</style>
