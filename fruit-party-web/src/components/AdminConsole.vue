<template>
  <main class="admin-console" data-test="admin-console">
    <aside class="admin-sidebar">
      <div class="brand"><span>FP</span><div><strong>FRUIT PARTY</strong><small>运营控制台</small></div></div>
      <nav aria-label="后台模块">
        <button v-for="item in navItems" :key="item.id" :data-test="`admin-nav-${item.id}`" :class="{ active: section === item.id }" type="button" @click="$emit('navigate', item.id)"><span>{{ item.icon }}</span>{{ item.label }}</button>
      </nav>
      <button class="logout-button" type="button" @click="$emit('logout')">退出管理员</button>
    </aside>

    <section class="admin-main">
      <header class="admin-topbar"><div><p>ADMINISTRATION</p><h1>{{ currentNav.label }}</h1></div><div class="admin-top-actions"><span :class="['maintenance-status', { active: maintenanceEnabled }]">{{ maintenanceEnabled ? '维护中' : '正常服务' }}</span><button data-test="maintenance-toggle" :class="['maintenance-toggle', { active: maintenanceEnabled }]" type="button" @click="$emit('maintenance-change', !maintenanceEnabled)">{{ maintenanceEnabled ? '结束维护' : '开启维护' }}</button><span class="admin-status"><i></i>管理员已登录</span></div></header>

      <template v-if="section === 'overview'">
        <section class="metric-grid" aria-label="运营指标">
          <article class="metric-card" data-test="metric-users"><small>玩家总数</small><strong>{{ formatNumber(dashboard.totalPlayers) }}</strong><span class="up">{{ formatNumber(dashboard.activePlayers) }} 名可用玩家</span></article>
          <article class="metric-card"><small>今日活跃</small><strong>{{ formatNumber(dashboard.todayActivePlayers) }}</strong><span class="up">{{ formatNumber(dashboard.todayGameAttempts) }} 局对战</span></article>
          <article class="metric-card"><small>游戏场次</small><strong>{{ formatNumber(dashboard.gameAttempts) }}</strong><span class="muted">普通 / 困难 / 无尽</span></article>
          <article class="metric-card"><small>金币流通总量</small><strong>{{ formatNumber(dashboard.coinsIssued) }}</strong><span class="up">结算与赠送金币</span></article>
        </section>
        <section class="dashboard-grid"><article class="panel activity-panel"><div class="panel-heading"><h2>近 7 日活跃趋势</h2><span>玩家登录数</span></div><div class="bar-chart"><div v-for="(point, index) in dashboard.activityTrend" :key="index" class="bar-column"><span :style="{ height: `${trendHeight(point.value)}%` }"></span><small>{{ point.label }}</small></div></div></article><article class="panel distribution-panel"><div class="panel-heading"><h2>模式参与分布</h2><span>本月场次</span></div><div class="donut"><div><strong>{{ formatNumber(modeAttemptsTotal) }}</strong><small>总场次</small></div></div><div class="legend"><span><i class="normal-dot"></i>普通 {{ modePercentage('normal') }}%</span><span><i class="hard-dot"></i>困难 {{ modePercentage('hard') }}%</span><span><i class="endless-dot"></i>无尽 {{ modePercentage('endless') }}%</span></div></article></section>
      </template>

      <template v-else-if="section === 'users'">
        <PlayerAuditLog v-if="selectedUser" :player="selectedUser" :loader="loadPlayerAuditLogs" @back="selectedUser = null" />
        <section v-else class="panel table-panel users-panel">
          <div class="panel-heading user-table-heading">
            <div><h2>用户管理</h2><span>查看、筛选和管理玩家账号</span></div>
            <div class="user-filters" aria-label="用户筛选条件">
              <input v-model="userSearch" data-test="user-search" class="search-input" placeholder="搜索用户名" />
              <input v-model="userJoinedSearch" data-test="user-joined-search" class="search-input joined-search" placeholder="注册日期，如 2026-09" />
            </div>
          </div>
          <div class="table-wrap">
            <table class="user-table">
              <thead>
                <tr>
                  <th>玩家</th>
                  <th>注册时间</th>
                  <th>最高关卡</th>
                  <th>金币</th>
                  <th>状态</th>
                  <th class="user-action-heading">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in pagedUsers" :key="user.id" :data-test="`user-row-${user.id}`">
                  <td><strong>{{ user.username }}</strong><small>#{{ user.id }}</small></td>
                  <td>{{ user.joined }}</td>
                  <td>{{ user.level }}</td>
                  <td>{{ user.coins }}</td>
                  <td><span :data-test="`user-status-${user.id}`" :class="['status-pill', user.enabled ? 'enabled' : 'disabled']">{{ user.enabled ? '正常' : '已停用' }}</span></td>
                  <td class="user-action-cell">
                    <div class="user-actions">
                      <button :data-test="`view-player-logs-${user.id}`" class="table-action" type="button" @click="openPlayerAudit(user)">查看日志</button>
                      <button :data-test="`toggle-user-${user.id}`" class="table-action" type="button" @click="toggleUser(user)">{{ user.enabled ? '停用' : '启用' }}</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <footer class="pagination pagination--fixed" data-test="users-pagination"><span>第 {{ userPage }} / {{ userPageCount }} 页 · {{ filteredUsers.length }} 名玩家</span><div class="pagination-actions"><button data-test="users-previous" type="button" :disabled="userPage <= 1" @click="userPage -= 1">上一页</button><button data-test="users-next" type="button" :disabled="userPage >= userPageCount" @click="userPage += 1">下一页</button></div></footer>
        </section>
      </template>

      <template v-else-if="section === 'economy'">
        <section class="panel table-panel"><div class="panel-heading"><div><h2>道具与价格</h2><span>调整后价格将记录到操作日志</span></div><button data-test="save-prices" class="primary-action recharge-style-action" type="button" @click="savePrices">保存价格</button></div><div class="price-list"><article v-for="item in priceItems" :key="item.id" class="price-item"><span class="price-icon">{{ item.icon }}</span><span><strong>{{ item.name }}</strong><small>{{ item.description }}</small></span><div class="price-stepper"><button :data-test="`decrease-price-${item.id}`" type="button" :aria-label="`下调 ${item.name} 价格`" @click="adjustPrice(item, -10)">−</button><input :data-test="`price-${item.id}`" v-model.number="item.price" type="text" inputmode="numeric" @change="normalizePrice(item)" /><button :data-test="`increase-price-${item.id}`" type="button" :aria-label="`上调 ${item.name} 价格`" @click="adjustPrice(item, 10)">+</button></div></article></div><p v-if="feedback" class="save-feedback">{{ feedback }}</p></section>
      </template>

      <AdminRechargeProducts
        v-else-if="section === 'recharge'"
        :loader="api.getAdminRechargeProducts"
        :saver="api.saveAdminRechargeProduct"
      />

      <AdminPermissionCenter
        v-else-if="section === 'permissions'"
        :loader="api.getAdminPermissions"
        :permission-updater="api.updateAdminInfiniteEnergy"
        :coin-granter="api.grantAdminCoins"
      />

      <AdminNotificationPublisher
        v-else-if="section === 'notifications'"
        :players="users"
        :loader="api.getAdminNotificationPublications"
        :publisher="api.publishAdminNotification"
      />

      <template v-else-if="section === 'logs'">
        <section class="panel table-panel">
          <div class="panel-heading log-heading">
            <div>
              <h2>操作日志</h2>
              <span>玩家游戏、后台操作与系统事件的统一记录</span>
            </div>
            <div class="log-filter-label">
              <span>事件类型</span>
              <AdminSelect :model-value="logFilter" :options="logFilterOptions" data-test="log-filter" aria-label="事件类型" @update:model-value="logFilter = $event" />
            </div>
          </div>

          <div class="table-wrap log-table-wrap">
            <table class="log-table" data-test="log-table">
              <thead>
                <tr><th>事件</th><th>类型</th><th>操作者 / 对象</th><th>时间</th></tr>
              </thead>
              <tbody>
                <tr v-for="log in filteredLogs" :key="log.id">
                  <td class="log-event"><strong>{{ log.action }}</strong><small>{{ log.detail }}</small></td>
                  <td><span :class="['log-type', log.type]">{{ log.typeLabel }}</span></td>
                  <td class="log-actor">{{ log.actor }}<template v-if="log.target"> <span>→</span> {{ log.target }}</template></td>
                  <td class="log-time">{{ log.time }}</td>
                </tr>
                <tr v-if="filteredLogs.length === 0"><td colspan="4" class="log-empty">当前筛选条件下没有记录</td></tr>
              </tbody>
            </table>
          </div>
          <footer class="log-footer">展示 {{ filteredLogs.length }} 条记录，按时间倒序加载。</footer>
        </section>
      </template>

      <template v-else-if="section === 'revenue'">
        <section class="metric-grid revenue-metrics"><article class="metric-card"><small>累计充值金额</small><strong>¥ {{ formatNumber(revenueData.totalRevenueCents / 100) }}</strong><span class="muted">真实充值订单</span></article><article class="metric-card"><small>已完成订单</small><strong>{{ formatNumber(revenueData.paidOrderCount) }}</strong><span class="up">订单已入账</span></article><article class="metric-card"><small>金币发放</small><strong>{{ formatNumber(revenueData.coinsIssued) }}</strong><span class="muted">订单权益</span></article></section>
        <section class="panel revenue-panel">
          <div class="panel-heading revenue-heading">
            <div><h2>充值金额趋势</h2><span>按选定区间聚合真实充值记录</span></div>
            <div class="revenue-controls">
              <div class="control-field"><span>统计区间</span><AdminSelect :model-value="revenueRange" :options="revenueRangeOptions" data-test="revenue-range" aria-label="统计区间" @update:model-value="setRevenueRange" /></div>
              <label><span>开始日期</span><input v-model="revenueStartDate" data-test="revenue-start-date" type="date" @input="applyCustomRevenueRange" /></label>
              <label><span>结束日期</span><input v-model="revenueEndDate" data-test="revenue-end-date" type="date" @input="applyCustomRevenueRange" /></label>
              <div v-if="revenueRange === 'custom'" class="control-field"><span>汇总单位</span><AdminSelect :model-value="revenueAggregation" :options="revenueAggregationSelectOptions" data-test="revenue-aggregation" aria-label="汇总单位" @update:model-value="setRevenueAggregation" /></div>
              <button data-test="query-revenue-range" class="range-query" type="button" @click="applyCustomRevenueRange">查询</button>
            </div>
          </div>
          <p v-if="revenueRangeError" data-test="revenue-range-error" class="revenue-range-error">{{ revenueRangeError }}</p>
          <div class="revenue-chart-meta"><strong>{{ revenueRangeLabel }}</strong><span data-test="revenue-granularity">按{{ revenueGranularity }}统计</span><span>{{ revenueChart.labels.length }} 个统计点</span></div>
          <div class="revenue-chart"><div v-for="(value, index) in revenueChart.values" :key="`${revenueRange}-${index}`" class="revenue-column"><span :style="{ height: `${value}%` }"></span><small>{{ revenueChart.labels[index] }}</small></div></div>
        </section>
      </template>
    </section>
  </main>
</template>

<script>
import { apiClient } from '../services/api.js'
import AdminSelect from './AdminSelect.vue'
import PlayerAuditLog from './PlayerAuditLog.vue'
import AdminRechargeProducts from './AdminRechargeProducts.vue'
import AdminPermissionCenter from './AdminPermissionCenter.vue'
import AdminNotificationPublisher from './AdminNotificationPublisher.vue'

const REVENUE_AGGREGATIONS = [
  { id: 'day', label: '按日' },
  { id: 'week', label: '按周' },
  { id: 'month', label: '按月' },
  { id: 'quarter', label: '按季' },
  { id: 'year', label: '按年' },
]

const LOG_FILTER_OPTIONS = [
  { value: 'all', label: '全部事件' },
  { value: 'player', label: '玩家游戏' },
  { value: 'admin', label: '后台操作' },
  { value: 'system', label: '系统日志' },
]

const REVENUE_RANGE_OPTIONS = [
  { value: '7d', label: '最近 7 日' },
  { value: '30d', label: '最近 30 日' },
  { value: '6m', label: '最近 6 个月' },
  { value: 'custom', label: '自定义区间' },
]

export default {
  name: 'AdminConsole',
  components: { AdminSelect, PlayerAuditLog, AdminRechargeProducts, AdminPermissionCenter, AdminNotificationPublisher },
  emits: ['navigate', 'logout', 'maintenance-change'],
  props: {
    section: { type: String, default: 'overview' },
    maintenanceEnabled: { type: Boolean, default: false },
    api: { type: Object, default: () => apiClient },
  },
  data() {
    return {
      dashboard: { totalPlayers: 0, activePlayers: 0, gameAttempts: 0, todayGameAttempts: 0, todayActivePlayers: 0, coinsIssued: 0, activityTrend: [], modeDistribution: [] },
      navItems: [{ id: 'overview', label: '数据总览', icon: '▦' }, { id: 'users', label: '用户管理', icon: '♙' }, { id: 'permissions', label: '权限中心', icon: '⚡' }, { id: 'notifications', label: '通知发布', icon: '◉' }, { id: 'economy', label: '道具与价格', icon: '◇' }, { id: 'recharge', label: '充值配置', icon: '¥' }, { id: 'logs', label: '操作日志', icon: '≡' }, { id: 'revenue', label: '营业额', icon: '◒' }],
      users: [],
      selectedUser: null,
      userPage: 1,
      userPageSize: 6,
      userSearch: '',
      userJoinedSearch: '',
      priceItems: [],
      feedback: '',
      logFilter: 'all',
      logFilterOptions: LOG_FILTER_OPTIONS,
      logs: [],
      revenueRange: '6m',
      revenueRangeOptions: REVENUE_RANGE_OPTIONS,
      revenueStartDate: '',
      revenueEndDate: '',
      revenueRangeError: '',
      revenueAggregation: 'day',
      revenueData: { label: '', labels: [], values: [], granularity: '日', totalRevenueCents: 0, paidOrderCount: 0, coinsIssued: 0 },
    }
  },
  computed: {
    currentNav() { return this.navItems.find((item) => item.id === this.section) || this.navItems[0] },
    modeAttemptsTotal() { return this.dashboard.modeDistribution.reduce((total, item) => total + Number(item.attempts || 0), 0) },
    // 两个条件都按“包含”匹配，日期可输入年、年-月或完整日期，无需记住固定格式。
    filteredUsers() {
      const keyword = this.userSearch.trim().toLowerCase()
      const joinedKeyword = this.userJoinedSearch.trim()
      return this.users.filter((user) => (
        (!keyword || user.username.toLowerCase().includes(keyword))
        && (!joinedKeyword || user.joined.includes(joinedKeyword))
      ))
    },
    userPageCount() { return Math.max(1, Math.ceil(this.filteredUsers.length / this.userPageSize)) },
    pagedUsers() { return this.filteredUsers.slice((this.userPage - 1) * this.userPageSize, this.userPage * this.userPageSize) },
    filteredLogs() { return this.logFilter === 'all' ? this.logs : this.logs.filter((log) => log.type === this.logFilter) },
    revenueChart() { return this.revenueData },
    revenueGranularity() { return this.revenueChart.granularity },
    revenueAggregationOptions() {
      const start = new Date(`${this.revenueStartDate}T00:00:00`)
      const end = new Date(`${this.revenueEndDate}T00:00:00`)
      if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start > end) return []
      const minimum = this.minimumRevenueAggregation(start, end)
      const minimumIndex = REVENUE_AGGREGATIONS.findIndex((item) => item.id === minimum)
      return REVENUE_AGGREGATIONS.slice(minimumIndex)
    },
    revenueAggregationSelectOptions() { return this.revenueAggregationOptions.map((option) => ({ value: option.id, label: option.label })) },
    revenueRangeLabel() { return this.revenueRange === 'custom' ? `${this.revenueStartDate} 至 ${this.revenueEndDate}` : this.revenueChart.label },
  },
  created() {
    this.syncRevenuePreset(this.revenueRange)
    this.loadAdminData()
    this.loadAuditLogs()
    this.loadRevenue()
  },
  watch: {
    // 左侧导航离开用户模块时释放详情状态，重新进入时始终从用户列表开始。
    section(nextSection) {
      if (nextSection !== 'users') this.selectedUser = null
      if (nextSection === 'logs') this.loadAuditLogs()
      if (nextSection === 'revenue') this.loadRevenue()
    },
    // 改变筛选条件时返回首屏，避免原本位于第 2 页却看到空表格。
    userSearch() { this.userPage = 1 },
    userJoinedSearch() { this.userPage = 1 },
    logFilter() { this.loadAuditLogs() },
  },
  methods: {
    formatNumber(value) { return Number(value || 0).toLocaleString('zh-CN') },
    modePercentage(mode) { return this.dashboard.modeDistribution.find((item) => item.mode === mode)?.percentage || 0 },
    trendHeight(value) {
      const maximum = Math.max(...this.dashboard.activityTrend.map((item) => Number(item.value || 0)), 1)
      return Math.max(4, Math.round(Number(value || 0) * 100 / maximum))
    },
    async loadAdminData() {
      try {
        const [players, items, dashboard] = await Promise.all([
          this.api.getAdminPlayers(),
          this.api.getAdminItems(),
          this.api.getAdminDashboard(),
        ])
        this.users = players.map((player) => ({
          id: player.id,
          username: player.username,
          joined: String(player.createdAt || '').slice(0, 10),
          level: `普通 ${player.normalHighestLevel || 0} / 困难 ${player.hardHighestLevel || 0}`,
          coins: Number(player.coins || 0).toLocaleString('zh-CN'),
          enabled: !player.isDisabled,
        }))
        this.priceItems = items.map((item) => ({
          id: item.id,
          icon: this.itemIcon(item.itemKey),
          name: item.displayName,
          description: item.description,
          price: Number(item.priceCoins),
        }))
        this.dashboard = dashboard
      } catch (error) {
        this.feedback = error.message || '后台数据加载失败，请刷新页面后重试'
      }
    },
    async loadAuditLogs() {
      try {
        const result = await this.api.getAdminAuditLogs({ type: this.logFilter, page: 1, pageSize: 100 })
        this.logs = result.items
      } catch (error) {
        this.logs = []
        this.feedback = error.message || '操作日志加载失败，请刷新页面后重试'
      }
    },
    async loadRevenue() {
      try {
        const result = await this.api.getAdminRevenue({
          startDate: this.revenueStartDate,
          endDate: this.revenueEndDate,
          aggregation: this.revenueAggregation,
        })
        const maximum = Math.max(...result.points.map((point) => Number(point.valueCents || 0)), 1)
        this.revenueData = {
          label: this.revenueRange === 'custom' ? `${this.revenueStartDate} 至 ${this.revenueEndDate}` : this.revenueRange === '7d' ? '最近 7 日' : this.revenueRange === '30d' ? '最近 30 日' : '最近 6 个月',
          labels: result.points.map((point) => point.label),
          values: result.points.map((point) => Math.max(0, Math.round(Number(point.valueCents || 0) * 100 / maximum))),
          granularity: ({ day: '日', week: '周', month: '月', quarter: '季', year: '年' })[result.aggregation],
          totalRevenueCents: result.totalRevenueCents,
          paidOrderCount: result.paidOrderCount,
          coinsIssued: result.coinsIssued,
        }
      } catch (error) {
        this.revenueData = { label: '', labels: [], values: [], granularity: '日', totalRevenueCents: 0, paidOrderCount: 0, coinsIssued: 0 }
        this.feedback = error.message || '营收数据加载失败，请刷新页面后重试'
      }
    },
    itemIcon(itemKey) {
      return ({ 'revive-card': '◔', 'bomb-clear-card': '◇', 'score-boost-card': 'B', 'energy-card': '✦' })[itemKey] || '◆'
    },
    openPlayerAudit(user) { this.selectedUser = user },
    async loadPlayerAuditLogs(playerId, { page, pageSize, type }) {
      return this.api.getAdminPlayerAuditLogs(playerId, { page, pageSize, type })
    },
    // 管理员价格步进统一为 10 金币；文本框仍允许直接输入，失焦时会修正为有效整数。
    adjustPrice(item, amount) { item.price = Math.max(10, Number(item.price || 0) + amount) },
    normalizePrice(item) { item.price = Math.max(10, Math.round(Number(item.price) || 10)) },
    async toggleUser(user) {
      try {
        await this.api.setAdminPlayerStatus(user.id, user.enabled)
        user.enabled = !user.enabled
      } catch (error) { this.feedback = error.message || '账号状态更新失败' }
    },
    async savePrices() {
      try {
        await Promise.all(this.priceItems.map((item) => this.api.updateAdminItemPrice(item.id, item.price)))
        this.feedback = '价格已保存'
      } catch (error) { this.feedback = error.message || '价格保存失败' }
    },
    formatDateInput(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    setRevenueRange(range) {
      this.revenueRange = range
      if (range === 'custom') this.applyCustomRevenueRange()
      else {
        this.syncRevenuePreset(range)
        this.revenueAggregation = this.minimumRevenueAggregation(new Date(`${this.revenueStartDate}T00:00:00`), new Date(`${this.revenueEndDate}T00:00:00`))
        this.loadRevenue()
      }
    },
    syncRevenuePreset(range, today = new Date()) {
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const start = new Date(end)
      if (range === '7d') start.setDate(end.getDate() - 6)
      else if (range === '30d') start.setDate(end.getDate() - 29)
      else if (range === '6m') start.setFullYear(end.getFullYear(), end.getMonth() - 5, 1)
      else return

      this.revenueStartDate = this.formatDateInput(start)
      this.revenueEndDate = this.formatDateInput(end)
      this.revenueRangeError = ''
    },
    setRevenueAggregation(aggregation) {
      this.revenueAggregation = aggregation
      this.rebuildCustomRevenueChart()
    },
    minimumRevenueAggregation(start, end) {
      const dayCount = Math.floor((end - start) / 86400000) + 1
      if (dayCount <= 14) return 'day'
      if (dayCount <= 90) return 'week'
      if (dayCount <= 334) return 'month'
      if (dayCount <= 487) return 'quarter'
      return 'year'
    },
    rebuildCustomRevenueChart() {
      if (this.revenueRange !== 'custom') return
      const start = new Date(`${this.revenueStartDate}T00:00:00`)
      const end = new Date(`${this.revenueEndDate}T00:00:00`)
      if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start > end) return
      this.loadRevenue()
    },
    applyCustomRevenueRange() {
      this.revenueRange = 'custom'
      const start = new Date(`${this.revenueStartDate}T00:00:00`)
      const end = new Date(`${this.revenueEndDate}T00:00:00`)
      if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
        this.revenueRangeError = '请选择有效的开始日期和结束日期。'
        return
      }
      if (start > end) {
        this.revenueRangeError = '开始日期不能晚于结束日期。'
        return
      }

      this.revenueRangeError = ''
      this.revenueAggregation = this.minimumRevenueAggregation(start, end)
      this.loadRevenue()
    },
  },
}
</script>

<style scoped>
.recharge-style-action { min-height: 34px; padding: 0 13px; border: 1px solid #8e7133; border-radius: 4px; background: #4b391d; color: #f2d376; font-weight: 700; }
.admin-console { display: flex; min-height: 100vh; background: #070c15; color: #eaf0fa; }.admin-sidebar { display: flex; width: 220px; flex-direction: column; padding: 25px 14px; border-right: 1px solid #253750; background: #0a1220; }.brand { display: flex; align-items: center; gap: 10px; padding: 0 10px 26px; border-bottom: 1px solid #1e3048; }.brand > span { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid #d8b65b; border-radius: 50%; color: #e7c66e; font-size: 10px; font-weight: 800; }.brand strong, .brand small { display: block; }.brand strong { font-size: 12px; letter-spacing: 1px; }.brand small { margin-top: 4px; color: #8196b5; font-size: 10px; }nav { display: grid; gap: 5px; margin-top: 22px; }nav button, .logout-button { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 11px; border: 1px solid transparent; background: transparent; color: #91a5c2; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }nav button span { width: 17px; color: #d8b65b; text-align: center; }nav button.active, nav button:hover { border-color: #314966; background: #14243b; color: #f0d47e; }.logout-button { margin-top: auto; border-top: 1px solid #1e3048; padding-top: 17px; color: #aebcd0; }.admin-main { min-width: 0; flex: 1; padding: 32px 36px; }.admin-topbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 27px; }.admin-topbar p { margin: 0 0 7px; color: #d4b35c; font-size: 10px; letter-spacing: 2px; }.admin-topbar h1 { margin: 0; font-size: 26px; }.admin-status { color: #9db0c9; font-size: 11px; }.admin-status i { display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #62c98a; }.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }.metric-card, .panel { border: 1px solid #263c5c; background: #0d1727; }.metric-card { padding: 17px; }.metric-card small, .metric-card strong, .metric-card span { display: block; }.metric-card small { color: #8fa5c2; font-size: 11px; }.metric-card strong { margin: 10px 0 6px; color: #f1d277; font-size: 25px; }.metric-card span { font-size: 10px; }.up { color: #75c995; }.muted { color: #7187a5; }.dashboard-grid { display: grid; grid-template-columns: 1.45fr 1fr; gap: 14px; margin-top: 14px; }.panel { padding: 22px; }.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 15px; margin-bottom: 22px; }.panel-heading h2 { margin: 0; font-size: 16px; }.panel-heading span { color: #8297b5; font-size: 10px; }.bar-chart, .revenue-chart { display: flex; height: 190px; align-items: end; gap: 13px; padding: 10px 6px 0; border-bottom: 1px solid #263c5c; }.bar-column, .revenue-column { display: flex; height: 100%; flex: 1; flex-direction: column; align-items: center; justify-content: end; gap: 8px; }.bar-column span, .revenue-column span { width: min(28px, 70%); min-height: 4px; border-radius: 3px 3px 0 0; background: linear-gradient(#d4b75d, #745728); }.bar-column small, .revenue-column small { color: #7890af; font-size: 9px; }.donut { display: grid; width: 150px; height: 150px; margin: 7px auto 16px; place-items: center; border-radius: 50%; background: conic-gradient(#d2ad4c 0 48%, #bd5960 48% 79%, #6650a2 79% 100%); }.donut > div { display: grid; width: 96px; height: 96px; place-items: center; align-content: center; border-radius: 50%; background: #0d1727; }.donut strong { font-size: 17px; }.donut small { margin-top: 3px; color: #8196b5; font-size: 9px; }.legend { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; color: #a5b5ca; font-size: 10px; }.legend i { display: inline-block; width: 7px; height: 7px; margin-right: 4px; border-radius: 50%; }.normal-dot { background: #d2ad4c; }.hard-dot { background: #bd5960; }.endless-dot { background: #6650a2; }.table-panel { min-height: 430px; }.search-input, select { min-height: 33px; padding: 0 9px; border: 1px solid #344e70; background: #111e31; color: #dde8f6; font-size: 11px; }.table-wrap { overflow-x: auto; }table { width: 100%; border-collapse: collapse; font-size: 11px; }th { padding: 11px 9px; color: #8196b5; font-size: 10px; font-weight: 500; text-align: left; }td { padding: 13px 9px; border-top: 1px solid #20344e; color: #b9c8da; }td strong, td small { display: block; }td strong { color: #e4ebf5; }td small { margin-top: 3px; color: #738aa9; font-size: 9px; }.status-pill { display: inline-block; padding: 4px 7px; border-radius: 3px; font-size: 9px; }.status-pill.enabled { background: #173a2c; color: #76d29a; }.status-pill.disabled { background: #3f2025; color: #ed949d; }.table-action, .primary-action { min-height: 29px; padding: 0 9px; border: 1px solid #7d652e; background: #2a2416; color: #e8cb72; font-size: 10px; cursor: pointer; }.primary-action { min-height: 34px; padding: 0 13px; background: #765724; color: #ffeaa0; font-weight: 700; }.pagination { display: flex; justify-content: space-between; margin-top: 22px; color: #8297b5; font-size: 10px; }.pagination-actions { display: flex; gap: 7px; }.pagination button { min-height: 28px; border: 1px solid #344e70; background: #14243b; color: #c6d5e8; font-size: 10px; cursor: pointer; }.pagination button:disabled { opacity: .4; cursor: not-allowed; }.price-list { display: grid; gap: 9px; }.price-list label { display: grid; grid-template-columns: 36px 1fr 90px; align-items: center; gap: 12px; padding: 12px; border: 1px solid #203650; background: #101d30; }.price-icon { display: grid; width: 30px; height: 30px; place-items: center; border: 1px solid #c9a950; border-radius: 50%; color: #e6c96d; }.price-list strong, .price-list small { display: block; }.price-list strong { font-size: 12px; }.price-list small { margin-top: 3px; color: #8095b2; font-size: 10px; }.price-list input { min-height: 32px; border: 1px solid #3a5271; background: #0a1321; color: #f2d67c; text-align: right; }.save-feedback { color: #75c995; font-size: 11px; }.log-list { display: grid; gap: 2px; }.log-list article { display: grid; grid-template-columns: 12px 1fr auto; align-items: center; gap: 10px; padding: 15px 0; border-bottom: 1px solid #20344e; }.log-dot { width: 7px; height: 7px; border-radius: 50%; }.log-dot.admin { background: #d6b65b; }.log-dot.system { background: #6ca8e8; }.log-list strong, .log-list small { display: block; }.log-list strong { font-size: 12px; }.log-list small, .log-list code { margin-top: 4px; color: #8095b2; font-size: 10px; }.log-list code { color: #aabbd0; }.date-label { padding: 5px 8px; border: 1px solid #304867; }.revenue-metrics { grid-template-columns: repeat(3, 1fr); margin-bottom: 14px; }.revenue-chart { height: 260px; }.revenue-column span { background: linear-gradient(#7f6cc7, #493c79); }
@media (max-width: 920px) { .metric-grid { grid-template-columns: repeat(2, 1fr); }.dashboard-grid { grid-template-columns: 1fr; } } @media (max-width: 680px) { .admin-sidebar { width: 58px; padding: 15px 8px; }.brand div { display: none; }.admin-sidebar nav button { font-size: 0; }.brand { justify-content: center; padding: 0 3px 18px; }.brand > span { width: 34px; }.admin-sidebar nav button { justify-content: center; padding: 0; }.admin-sidebar nav button span { font-size: 14px; }.logout-button { font-size: 0; padding: 0; justify-content: center; }.admin-main { padding: 22px 14px; }.admin-topbar h1 { font-size: 22px; }.metric-grid, .revenue-metrics { grid-template-columns: 1fr 1fr; }.panel { padding: 15px; }.panel-heading { flex-wrap: wrap; }.price-list label { grid-template-columns: 30px 1fr 75px; gap: 8px; } }
.log-heading { align-items: end; }.log-filter-label, .revenue-controls label, .control-field { display: grid; gap: 5px; color: #849ab7; font-size: 10px; }.log-filter-label .admin-select { min-width: 140px; }.revenue-controls .admin-select { min-width: 150px; }.revenue-controls input { min-width: 118px; min-height: 34px; box-sizing: border-box; padding: 0 7px; border: 1px solid #344e70; background: #111e31; color: #dde8f6; font: inherit; font-size: 11px; }.log-table-wrap { border-top: 1px solid #2a425f; }.log-table { width: 100%; border-collapse: collapse; font-size: 11px; }.log-table th { padding: 11px 12px; color: #8297b5; font-size: 10px; font-weight: 600; letter-spacing: .4px; text-align: left; }.log-table td { padding: 14px 12px; border-top: 1px solid #20344e; color: #b9c8da; vertical-align: middle; }.log-event { min-width: 280px; }.log-event strong, .log-event small { display: block; }.log-event strong { color: #e7eef8; font-size: 12px; }.log-event small { margin-top: 5px; color: #879bb8; font-size: 10px; }.log-type { display: inline-block; min-width: 52px; padding: 4px 6px; border-radius: 2px; font-size: 9px; text-align: center; }.log-type.admin { background: #3b3018; color: #edcf74; }.log-type.player { background: #173b2c; color: #82d3a2; }.log-type.system { background: #172f4d; color: #8ebeea; }.log-actor span { margin: 0 4px; color: #d2b865; }.log-time { white-space: nowrap; color: #859bb8 !important; font-size: 10px; }.log-empty { padding: 44px !important; color: #8095b2 !important; text-align: center; }.log-footer { margin-top: 16px; color: #7890ad; font-size: 10px; }.revenue-heading { align-items: end; }.revenue-controls { display: flex; flex-wrap: wrap; align-items: end; justify-content: end; gap: 8px; }.range-query { min-height: 34px; padding: 0 13px; border: 1px solid #7d652e; background: #2a2416; color: #e8cb72; font-size: 10px; cursor: pointer; }.revenue-chart-meta { display: flex; align-items: center; justify-content: space-between; padding: 0 6px 10px; color: #899ebb; font-size: 10px; }.revenue-chart-meta strong { color: #d8c276; font-size: 12px; }.revenue-chart { height: 260px; }.revenue-column span { background: linear-gradient(#7f6cc7, #493c79); }
@media (max-width: 920px) { .revenue-controls { justify-content: start; } } @media (max-width: 680px) { .log-table th:nth-child(3), .log-table td:nth-child(3) { display: none; }.log-event { min-width: 220px; }.revenue-controls label { flex: 1 1 120px; }.revenue-controls label:first-child { flex-basis: 100%; } }
.admin-top-actions { display: flex; align-items: center; justify-content: end; gap: 9px; }.maintenance-status { color: #82b995; font-size: 10px; }.maintenance-status.active { color: #edb778; }.maintenance-toggle { min-height: 31px; padding: 0 10px; border: 1px solid #3c5e7e; background: #132944; color: #cce0f6; font-size: 10px; cursor: pointer; }.maintenance-toggle.active { border-color: #9f6e32; background: #3b2918; color: #f1cb78; }
@media (max-width: 680px) { .admin-top-actions { flex-wrap: wrap; gap: 6px; }.admin-status { display: none; } }
.user-table { min-width: 900px; table-layout: fixed; }
.user-table th:nth-child(1), .user-table td:nth-child(1) { width: 14%; }
.user-table th:nth-child(2), .user-table td:nth-child(2) { width: 16%; }
.user-table th:nth-child(3), .user-table td:nth-child(3) { width: 20%; }
.user-table th:nth-child(4), .user-table td:nth-child(4) { width: 12%; }
.user-table th:nth-child(5), .user-table td:nth-child(5) { width: 10%; }
.user-table th:nth-child(6), .user-table td:nth-child(6) { width: 28%; }
.user-action-heading, .user-action-cell { text-align: right; }
.user-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.price-item { display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 12px; padding: 12px; border: 1px solid #203650; background: #101d30; }.price-stepper { display: grid; grid-template-columns: 38px 86px 38px; height: 40px; border: 1px solid #485f7b; background: #091322; }.price-stepper button { border: 0; border-right: 1px solid #354d69; background: #152640; color: #e8c86e; font-size: 20px; line-height: 1; cursor: pointer; }.price-stepper button:last-child { border-right: 0; border-left: 1px solid #354d69; }.price-stepper button:hover { background: #263b59; color: #ffdf83; }.price-stepper input { width: 100%; min-width: 0; box-sizing: border-box; border: 0; background: #0b1728; color: #f5d477; font-size: 21px; text-align: center; outline: none; }.price-stepper input:focus { background: #10223a; box-shadow: inset 0 0 0 1px #d1ae52; }
.user-table-heading { align-items: end; }.user-filters { display: flex; flex-wrap: wrap; justify-content: end; gap: 8px; }.user-filters .search-input { width: 152px; box-sizing: border-box; }.user-filters .joined-search { width: 170px; }.search-input:focus { border-color: #c8a751; outline: none; box-shadow: 0 0 0 2px #c8a75122; }
.revenue-range-error { margin: -8px 0 10px; color: #e69b9d; font-size: 11px; }
.users-panel { display: flex; min-height: 620px; flex-direction: column; }.users-panel .table-wrap { min-height: 392px; flex: 1; }.users-panel .pagination { margin-top: auto; }
.pagination--fixed { min-height: 34px; align-items: center; padding-top: 22px; box-sizing: border-box; }.pagination--fixed .pagination-actions { flex: 0 0 auto; }.pagination--fixed button { min-width: 56px; min-height: 34px; padding: 0 9px; border-color: #385475; background: #122137; color: #d5e2f4; font-size: 10px; }.pagination--fixed button:hover:not(:disabled) { border-color: #52749c; background: #172b46; }.pagination--fixed button:disabled { border-color: #243750; background: #0e1827; color: #657890; opacity: 1; }
.table-wrap { scrollbar-width: thin; scrollbar-color: #556171 #070c15; }
.table-wrap::-webkit-scrollbar { width: 10px; height: 10px; background: #070c15; }
.table-wrap::-webkit-scrollbar-track { background: #070c15; }
.table-wrap::-webkit-scrollbar-thumb { border: 2px solid #070c15; border-radius: 8px; background: #556171; }
.table-wrap::-webkit-scrollbar-thumb:hover { background: #687588; }
.table-wrap::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.table-wrap::-webkit-scrollbar-corner { background: #070c15; }
@media (max-width: 680px) { .user-filters { width: 100%; justify-content: start; }.user-filters .search-input, .user-filters .joined-search { flex: 1 1 140px; width: auto; }.pagination--fixed { align-items: flex-start; flex-direction: column; } }
.primary-action.recharge-style-action { min-height: 34px; padding: 0 13px; border: 1px solid #8e7133; border-radius: 4px; background: #4b391d; color: #f2d376; font-weight: 700; }
</style>
