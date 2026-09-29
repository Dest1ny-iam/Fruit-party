<template>
  <section class="player-audit" data-test="player-audit-log">
    <header class="audit-header">
      <div>
        <button class="back-button" type="button" data-test="back-to-users" @click="$emit('back')">返回用户管理</button>
        <p class="audit-kicker">PLAYER AUDIT TRAIL</p>
        <h2 data-test="audit-player-name">{{ player.username }}</h2>
        <p class="audit-meta">#{{ player.id }} · 注册于 {{ player.joined }} · {{ player.level }}</p>
      </div>
      <div class="audit-balance"><span>当前金币</span><strong>{{ player.coins }}</strong></div>
    </header>

    <nav class="audit-filters" aria-label="玩家日志类别">
      <button
        v-for="filter in filters"
        :key="filter.id"
        :data-test="`audit-filter-${filter.id}`"
        :class="{ active: type === filter.id }"
        type="button"
        @click="selectType(filter.id)"
      >{{ filter.label }}</button>
    </nav>

    <p v-if="loading" class="audit-state" data-test="audit-loading">正在加载玩家审计记录...</p>
    <div v-else-if="error" class="audit-state error" data-test="audit-error">
      <span>{{ error }}</span>
      <button type="button" @click="loadLogs">重新加载</button>
    </div>

    <div v-else class="audit-table-wrap">
      <table class="audit-table">
        <thead><tr><th>行为详情</th><th>类别</th><th>发生时间</th><th>金币变动</th></tr></thead>
        <tbody>
          <tr v-for="record in records" :key="record.id" :data-test="`audit-row-${record.id}`">
            <td class="audit-event"><strong>{{ record.action }}</strong><small>{{ record.detail }}</small></td>
            <td><span :class="['audit-category', record.category]">{{ record.categoryLabel }}</span></td>
            <td class="audit-time">{{ record.time }}</td>
            <td class="audit-balance-change">
              <span>{{ formatBalance(record.balanceBefore) }}</span><b>→</b><strong>{{ formatBalance(record.balanceAfter) }}</strong>
            </td>
          </tr>
          <tr v-if="records.length === 0"><td colspan="4" class="audit-empty">这个筛选条件下暂无记录</td></tr>
        </tbody>
      </table>
    </div>

    <footer class="audit-pagination pagination--fixed" data-test="audit-pagination">
      <span>第 {{ page }} / {{ pageCount }} 页，共 {{ total }} 条记录</span>
      <div>
        <button type="button" data-test="audit-previous-page" :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
        <button type="button" data-test="audit-next-page" :disabled="page >= pageCount" @click="changePage(page + 1)">下一页</button>
      </div>
    </footer>
  </section>
</template>

<script>
export default {
  name: 'PlayerAuditLog',
  emits: ['back'],
  props: {
    player: { type: Object, required: true },
    // 组件只依赖一个返回 Promise 的加载器；接真实后端时无需改动页面逻辑。
    loader: { type: Function, default: async () => ({ items: [], page: 1, pageSize: 6, total: 0 }) },
  },
  data() {
    return {
      filters: [
        { id: 'all', label: '全部记录' },
        { id: 'game', label: '游戏记录' },
        { id: 'account', label: '账户消费' },
        { id: 'item', label: '道具使用' },
      ],
      records: [],
      type: 'all',
      page: 1,
      pageSize: 6,
      total: 0,
      loading: false,
      error: '',
      requestSequence: 0,
    }
  },
  computed: {
    pageCount() { return Math.max(1, Math.ceil(this.total / this.pageSize)) },
  },
  watch: {
    player: {
      immediate: true,
      handler() {
        this.page = 1
        this.type = 'all'
        this.loadLogs()
      },
    },
  },
  methods: {
    async loadLogs() {
      if (!this.player?.id) return
      const requestId = ++this.requestSequence
      this.loading = true
      this.error = ''
      try {
        const result = await this.loader(this.player.id, { page: this.page, pageSize: this.pageSize, type: this.type })
        // 快速切换筛选时，只接收最后一次请求的响应，避免旧数据覆盖新数据。
        if (requestId !== this.requestSequence) return
        this.records = result.items || []
        this.total = Number(result.total) || 0
      } catch (error) {
        if (requestId !== this.requestSequence) return
        this.error = error?.message || '玩家审计记录加载失败，请稍后重试。'
        this.records = []
        this.total = 0
      } finally {
        if (requestId === this.requestSequence) this.loading = false
      }
    },
    async selectType(type) {
      if (this.type === type) return
      this.type = type
      this.page = 1
      await this.loadLogs()
    },
    async changePage(nextPage) {
      if (nextPage < 1 || nextPage > this.pageCount || nextPage === this.page) return
      this.page = nextPage
      await this.loadLogs()
    },
    formatBalance(value) { return Number(value || 0).toLocaleString('zh-CN') },
  },
}
</script>

<style scoped>
.player-audit { display: flex; min-height: 620px; flex-direction: column; padding: 22px; border: 1px solid #263c5c; background: #0d1727; }.audit-header { display: flex; align-items: end; justify-content: space-between; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid #263c5c; }.back-button { min-height: 28px; padding: 0 9px; border: 1px solid #405c7d; background: #101e31; color: #b9cce4; font-size: 10px; cursor: pointer; }.audit-kicker { margin: 15px 0 5px; color: #d9b85f; font-size: 10px; font-weight: 700; letter-spacing: 1.6px; }.audit-header h2 { margin: 0; font-size: 20px; }.audit-meta { margin: 7px 0 0; color: #8095b2; font-size: 10px; }.audit-balance { min-width: 116px; padding: 12px 15px; border: 1px solid #3a516d; background: #101d30; text-align: right; }.audit-balance span, .audit-balance strong { display: block; }.audit-balance span { color: #879cb8; font-size: 10px; }.audit-balance strong { margin-top: 5px; color: #ebcb70; font-size: 19px; }.audit-filters { display: flex; flex-wrap: wrap; gap: 7px; margin: 20px 0; }.audit-filters button { min-height: 30px; padding: 0 10px; border: 1px solid #314a69; background: #101d30; color: #95aac6; font-size: 10px; cursor: pointer; }.audit-filters button.active { border-color: #c7a64d; background: #302719; color: #f0d67d; }.audit-state { display: grid; min-height: 180px; place-items: center; color: #879db9; font-size: 12px; }.audit-state.error { gap: 10px; color: #ea9ba1; }.audit-state button { min-height: 30px; border: 1px solid #785c30; background: #2b2418; color: #e8cd78; font-size: 10px; cursor: pointer; }.audit-table-wrap { min-height: 360px; flex: 1; overflow-x: auto; }.audit-table { width: 100%; min-width: 680px; border-collapse: collapse; font-size: 11px; }.audit-table th { padding: 11px 10px; color: #8399b7; font-size: 10px; font-weight: 600; text-align: left; }.audit-table td { padding: 14px 10px; border-top: 1px solid #20344e; color: #b7c6d8; vertical-align: middle; }.audit-event { min-width: 240px; }.audit-event strong, .audit-event small { display: block; }.audit-event strong { color: #e7eef8; font-size: 12px; }.audit-event small { margin-top: 5px; color: #8398b5; font-size: 10px; }.audit-category { display: inline-block; min-width: 54px; padding: 4px 6px; border-radius: 2px; font-size: 9px; text-align: center; }.audit-category.game { background: #173b2c; color: #83d5a3; }.audit-category.account { background: #3b3018; color: #f0d078; }.audit-category.item { background: #252044; color: #b6a7f1; }.audit-time { color: #839ab8 !important; white-space: nowrap; font-size: 10px; }.audit-balance-change { display: flex; min-width: 120px; align-items: center; gap: 6px; color: #8297b5; white-space: nowrap; }.audit-balance-change b { color: #d2b461; }.audit-balance-change strong { color: #e5c766; }.audit-empty { padding: 48px !important; color: #8197b4 !important; text-align: center; }.audit-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; color: #8197b5; font-size: 10px; }.audit-pagination div { display: flex; gap: 7px; }.pagination--fixed { min-height: 34px; padding-top: 20px; box-sizing: border-box; }.pagination--fixed button { min-width: 56px; min-height: 34px; padding: 0 9px; border: 1px solid #385475; background: #122137; color: #d5e2f4; font-size: 10px; cursor: pointer; }.pagination--fixed button:hover:not(:disabled) { border-color: #52749c; background: #172b46; }.pagination--fixed button:disabled { border-color: #243750; background: #0e1827; color: #657890; opacity: 1; cursor: not-allowed; }
@media (max-width: 680px) { .player-audit { padding: 16px; }.audit-header { align-items: start; flex-direction: column; }.audit-balance { width: 100%; box-sizing: border-box; text-align: left; }.audit-pagination { align-items: start; flex-direction: column; } }
</style>
