import { mount as vueMount } from '@vue/test-utils'
import { afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import AdminConsole from './AdminConsole.vue'

const adminConsoleSource = readFileSync(resolve(process.cwd(), 'src/components/AdminConsole.vue'), 'utf8')
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))
const flushMicrotasks = async () => { await Promise.resolve(); await Promise.resolve() }

const testPlayers = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1,
  username: index === 0 ? '水果达人' : index === 3 ? '切水果达人' : `测试玩家${index + 1}`,
  coins: 1000 + index * 100,
  createdAt: `2026-09-0${index + 1}T00:00:00.000Z`,
  normalHighestLevel: 2,
  hardHighestLevel: 1,
  isDisabled: false,
}))

function createApi(overrides = {}) {
  return {
    getAdminPlayers: vi.fn().mockResolvedValue(testPlayers.map((player) => ({ ...player }))),
    getAdminItems: vi.fn().mockResolvedValue([{ id: 'revive-card', itemKey: 'revive-card', displayName: '复活卡', description: '失败后恢复本局。', priceCoins: 600 }]),
    getAdminDashboard: vi.fn().mockResolvedValue({ totalPlayers: 7, activePlayers: 7, todayActivePlayers: 2, gameAttempts: 8, todayGameAttempts: 2, coinsIssued: 1200, activityTrend: [], modeDistribution: [] }),
    getAdminAuditLogs: vi.fn().mockResolvedValue({ items: [
      { id: 'player-1', type: 'player', typeLabel: '玩家游戏', actor: '水果达人', target: '', action: '游戏结算完成', detail: '普通模式第 1 关', time: '2026-09-21T12:00:00.000Z' },
      { id: 'admin-1', type: 'admin', typeLabel: '后台操作', actor: 'admin', target: '水果达人', action: '调整道具价格', detail: '复活卡 600 金币', time: '2026-09-21T10:00:00.000Z' },
    ], page: 1, pageSize: 100, total: 2 }),
    getAdminRevenue: vi.fn().mockImplementation(async ({ aggregation }) => ({ aggregation, totalRevenueCents: 100, paidOrderCount: 1, coinsIssued: 0, points: [{ label: '2026/9', valueCents: 100 }] })),
    getAdminPlayerAuditLogs: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 6, total: 0 }),
    setAdminPlayerStatus: vi.fn().mockResolvedValue({}),
    updateAdminItemPrice: vi.fn().mockResolvedValue({}),
    getAdminPermissions: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 6, total: 0 }),
    updateAdminInfiniteEnergy: vi.fn().mockResolvedValue({}),
    grantAdminCoins: vi.fn().mockResolvedValue({}),
    getAdminNotificationPublications: vi.fn().mockResolvedValue([]),
    publishAdminNotification: vi.fn().mockResolvedValue({}),
    getAdminRechargeProducts: vi.fn().mockResolvedValue([]),
    saveAdminRechargeProduct: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

// The application is on Vue 2, whose test-utils API expects propsData.
// Keep restored tests readable while preventing Vue 3-style props from silently
// mounting every case with the default section.
const mount = (component, options = {}) => {
  const { props, propsData, ...rest } = options
  const componentProps = propsData || props || {}
  return vueMount(component, { ...rest, propsData: { ...componentProps, api: createApi(componentProps.api) } })
}

describe('AdminConsole', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('显示总览指标和后台模块导航', () => {
    const wrapper = mount(AdminConsole, { props: { section: 'overview' } })

    expect(wrapper.get('[data-test="admin-console"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="metric-users"]').text()).toContain('玩家总数')
    expect(wrapper.get('[data-test="admin-nav-users"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="admin-nav-revenue"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="admin-nav-recharge"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="admin-nav-permissions"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="admin-nav-notifications"]').exists()).toBe(true)
  })

  it('loads the visible player table and item prices from the injected API', async () => {
    const api = {
      getAdminPlayers: vi.fn().mockResolvedValue([{ id: 9, username: '数据库玩家', coins: 480, energy: 4, createdAt: '2026-09-28T00:00:00.000Z', isDisabled: false }]),
      getAdminItems: vi.fn().mockResolvedValue([{ id: 6, itemKey: 'revive-card', displayName: '复活卡', description: '真实道具。', priceCoins: 480 }]),
      getAdminDashboard: vi.fn().mockResolvedValue({ totalPlayers: 1, activePlayers: 1, gameAttempts: 0, todayGameAttempts: 0, coinsIssued: 480 }),
    }
    const wrapper = mount(AdminConsole, { props: { section: 'users', api } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(api.getAdminPlayers).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('数据库玩家')
    expect(wrapper.text()).not.toContain('水果达人')
  })

  it('loads visible audit rows and revenue bars from the injected API instead of fixtures', async () => {
    const api = {
      getAdminPlayers: vi.fn().mockResolvedValue([]),
      getAdminItems: vi.fn().mockResolvedValue([]),
      getAdminDashboard: vi.fn().mockResolvedValue({ totalPlayers: 0, activePlayers: 0, gameAttempts: 0, todayGameAttempts: 0, coinsIssued: 0, activityTrend: [], modeDistribution: [] }),
      getAdminAuditLogs: vi.fn().mockResolvedValue({ items: [{ id: 'admin-1', type: 'admin', typeLabel: '后台操作', actor: 'admin', target: '9', action: '调整道具价格', detail: 'priceCoins: 480', time: '2026-09-28T00:00:00.000Z' }], page: 1, pageSize: 20, total: 1 }),
      getAdminRevenue: vi.fn().mockResolvedValue({ aggregation: 'month', totalRevenueCents: 100, paidOrderCount: 1, coinsIssued: 0, points: [{ label: '2026/9', valueCents: 100 }] }),
    }
    const wrapper = mount(AdminConsole, { props: { section: 'logs', api } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(api.getAdminAuditLogs).toHaveBeenCalledWith({ type: 'all', page: 1, pageSize: 100 })
    expect(wrapper.text()).toContain('调整道具价格')

    await wrapper.setProps({ section: 'revenue' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(api.getAdminRevenue).toHaveBeenCalled()
    expect(wrapper.get('.revenue-column').text()).toContain('2026/9')
  })

  it('明确将营业额区域标记为真实订单数据，而不是演示或虚拟数据', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushPromises()

    expect(wrapper.text()).toContain('累计充值金额')
    expect(wrapper.text()).toContain('真实充值订单')
    expect(wrapper.text()).not.toContain('虚拟营业额')
    expect(wrapper.text()).not.toContain('演示数据')
  })

  it('通知发布页支持全体或勾选部分玩家', async () => {
    const api = createApi()
    const wrapper = mount(AdminConsole, { props: { section: 'notifications', api } })
    await flushPromises()

    expect(wrapper.get('[data-test="admin-notification-publisher"]').exists()).toBe(true)
    expect(api.getAdminNotificationPublications).toHaveBeenCalledOnce()
  })

  it('权限导航显示独立的玩家特殊权限中心', async () => {
    const api = createApi()
    const wrapper = mount(AdminConsole, { props: { section: 'permissions', api } })
    await flushPromises()

    expect(wrapper.get('[data-test="admin-permission-center"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('特殊权限中心')
    expect(api.getAdminPermissions).toHaveBeenCalledWith({ page: 1, pageSize: 6, keyword: '' })
  })

  it('充值配置导航显示独立的商品管理模块', async () => {
    const api = createApi()
    const wrapper = mount(AdminConsole, { props: { section: 'recharge', api } })
    await flushPromises()

    expect(wrapper.get('[data-test="admin-recharge-products"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('充值商品配置')
    expect(api.getAdminRechargeProducts).toHaveBeenCalledOnce()
  })

  it('用户页支持分页和启用状态切换', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'users' } })
    await flushPromises()

    expect(wrapper.get('.user-table').exists()).toBe(true)
    expect(wrapper.get('[data-test="users-pagination"]').classes()).toContain('pagination--fixed')
    expect(wrapper.get('[data-test="users-previous"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test="user-row-1"] td:last-child').classes()).toContain('user-action-cell')
    expect(wrapper.get('[data-test="user-row-1"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="user-row-6"]').exists()).toBe(true)
    expect(wrapper.vm.userPageSize).toBe(6)
    const firstStatus = wrapper.get('[data-test="user-status-1"]').text()
    await wrapper.get('[data-test="toggle-user-1"]').trigger('click')
    expect(wrapper.get('[data-test="user-status-1"]').text()).not.toBe(firstStatus)

    await wrapper.get('[data-test="users-next"]').trigger('click')
    expect(wrapper.find('[data-test="user-row-1"]').exists()).toBe(false)

    await wrapper.get('[data-test="users-previous"]').trigger('click')
    expect(wrapper.get('[data-test="user-row-1"]').exists()).toBe(true)
  })

  it('用户页支持按用户名和注册日期片段模糊筛选', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'users' } })
    await flushPromises()

    await wrapper.get('[data-test="user-search"]').setValue('切')
    await wrapper.get('[data-test="user-joined-search"]').setValue('09-04')

    expect(wrapper.get('[data-test="user-row-4"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="user-row-1"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('1 名玩家')
  })

  it('管理员可从用户表进入指定玩家的审计日志并返回列表', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'users' } })
    await flushPromises()

    await wrapper.get('[data-test="view-player-logs-1"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-test="player-audit-log"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="audit-player-name"]').text()).toBe('水果达人')

    await wrapper.get('[data-test="back-to-users"]').trigger('click')
    expect(wrapper.get('[data-test="user-row-1"]').exists()).toBe(true)
  })

  it('价格页用自定义加减按钮调整道具价格并显示保存反馈', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'economy' } })
    await flushPromises()
    const input = wrapper.get('[data-test="price-revive-card"]')

    expect(wrapper.get('[data-test="save-prices"]').classes()).toContain('recharge-style-action')
    expect(input.attributes('type')).toBe('text')
    await wrapper.get('[data-test="increase-price-revive-card"]').trigger('click')
    expect(input.element.value).toBe('610')
    await wrapper.get('[data-test="decrease-price-revive-card"]').trigger('click')
    expect(input.element.value).toBe('600')

    await input.setValue('777')
    await wrapper.get('[data-test="save-prices"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('价格已保存')
    expect(input.element.value).toBe('777')
  })

  it('matches the publish notification button dimensions and colors', () => {
    const wrapper = mount(AdminConsole, { props: { section: 'economy' } })

    expect(wrapper.get('[data-test="save-prices"]').classes()).toContain('recharge-style-action')
    expect(adminConsoleSource).toMatch(/\.primary-action\.recharge-style-action\s*\{[^}]*min-height:\s*34px[^}]*padding:\s*0 14px[^}]*background:\s*#4d391d[^}]*color:\s*#f4d779[^}]*font-size:\s*16px/s)
  })

  it('日志页按类型筛选，并在表格中显示操作者、对象和时间', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'logs' } })
    await flushPromises()

    expect(wrapper.get('[data-test="log-table"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('操作者 / 对象')
    expect(wrapper.text()).toContain('游戏结算完成')

    await wrapper.get('[data-test="log-filter"]').trigger('click')
    await wrapper.get('[data-test="log-filter-option-player"]').trigger('click')
    expect(wrapper.text()).toContain('水果达人')
    expect(wrapper.text()).not.toContain('调整道具价格')
  })

  it('营业额页可切换近 7 日区间并同步更新图表标签', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 21, 12, 0, 0))
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushMicrotasks()

    expect(wrapper.text()).toContain('最近 6 个月')
    expect(wrapper.get('[data-test="revenue-start-date"]').attributes('type')).toBe('date')
    expect(wrapper.get('[data-test="revenue-end-date"]').attributes('type')).toBe('date')
    await wrapper.get('[data-test="revenue-range"]').trigger('click')
    await wrapper.get('[data-test="revenue-range-option-7d"]').trigger('click')
    await flushMicrotasks()
    expect(wrapper.text()).toContain('最近 7 日')
    expect(wrapper.text()).toContain('日')
    expect(wrapper.get('[data-test="revenue-start-date"]').element.value).toBe('2026-09-15')
    expect(wrapper.get('[data-test="revenue-end-date"]').element.value).toBe('2026-09-21')
  })

  it('营业额预设区间同步最近 30 日和最近 6 个月的日期', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 21, 12, 0, 0))
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushMicrotasks()

    await wrapper.get('[data-test="revenue-range"]').trigger('click')
    await wrapper.get('[data-test="revenue-range-option-30d"]').trigger('click')
    await flushMicrotasks()
    expect(wrapper.get('[data-test="revenue-start-date"]').element.value).toBe('2026-08-23')
    expect(wrapper.get('[data-test="revenue-end-date"]').element.value).toBe('2026-09-21')

    await wrapper.get('[data-test="revenue-range"]').trigger('click')
    await wrapper.get('[data-test="revenue-range-option-6m"]').trigger('click')
    await flushMicrotasks()
    expect(wrapper.get('[data-test="revenue-start-date"]').element.value).toBe('2026-04-01')
    expect(wrapper.get('[data-test="revenue-end-date"]').element.value).toBe('2026-09-21')
  })

  it('手动修改统计日期后自动切换为自定义区间', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushPromises()

    await wrapper.get('[data-test="revenue-start-date"]').setValue('2026-09-10')
    expect(wrapper.vm.revenueRange).toBe('custom')
  })

  it('营业额自定义区间保留原生日历并可查询', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushPromises()

    await wrapper.get('[data-test="revenue-start-date"]').setValue('2026-09-15')
    await wrapper.get('[data-test="revenue-end-date"]').setValue('2026-09-21')
    await wrapper.get('[data-test="query-revenue-range"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('2026-09-15 至 2026-09-21')
  })

  it('营业额短日期区间按日聚合', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushPromises()

    await wrapper.get('[data-test="revenue-start-date"]').setValue('2026-09-15')
    await wrapper.get('[data-test="revenue-end-date"]').setValue('2026-09-21')
    await wrapper.get('[data-test="query-revenue-range"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="revenue-granularity"]').text()).toBe('按日统计')
  })

  it('营业额二十天区间默认按周聚合', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushPromises()

    await wrapper.get('[data-test="revenue-start-date"]').setValue('2026-09-01')
    await wrapper.get('[data-test="revenue-end-date"]').setValue('2026-09-20')
    await wrapper.get('[data-test="query-revenue-range"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="revenue-granularity"]').text()).toBe('按周统计')
  })

  it('营业额超过一个月的日期区间按月聚合', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushPromises()

    await wrapper.get('[data-test="revenue-start-date"]').setValue('2026-01-01')
    await wrapper.get('[data-test="revenue-end-date"]').setValue('2026-09-21')
    await wrapper.get('[data-test="query-revenue-range"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="revenue-granularity"]').text()).toBe('按月统计')
  })

  it('营业额十二个月区间默认按季聚合', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushPromises()

    await wrapper.get('[data-test="revenue-start-date"]').setValue('2025-09-22')
    await wrapper.get('[data-test="revenue-end-date"]').setValue('2026-09-21')
    await wrapper.get('[data-test="query-revenue-range"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="revenue-granularity"]').text()).toBe('按季统计')
  })

  it('营业额十六个月区间默认按年聚合', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushPromises()

    await wrapper.get('[data-test="revenue-start-date"]').setValue('2025-05-21')
    await wrapper.get('[data-test="revenue-end-date"]').setValue('2026-09-21')
    await wrapper.get('[data-test="query-revenue-range"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="revenue-granularity"]').text()).toBe('按年统计')
  })

  it('短日期区间允许手动改用更粗的按月汇总', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushPromises()

    await wrapper.get('[data-test="revenue-start-date"]').setValue('2026-09-15')
    await wrapper.get('[data-test="revenue-end-date"]').setValue('2026-09-21')
    await wrapper.get('[data-test="query-revenue-range"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="revenue-aggregation"]').trigger('click')
    await wrapper.get('[data-test="revenue-aggregation-option-month"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="revenue-granularity"]').text()).toBe('按月统计')
  })

  it('营业额超过两年的日期区间按年聚合', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })
    await flushPromises()

    await wrapper.get('[data-test="revenue-start-date"]').setValue('2024-01-01')
    await wrapper.get('[data-test="revenue-end-date"]').setValue('2026-09-21')
    await wrapper.get('[data-test="query-revenue-range"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="revenue-granularity"]').text()).toBe('按年统计')
  })

  it('营业额日期范围反向时显示提示而不生成图表', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'revenue' } })

    await wrapper.get('[data-test="revenue-start-date"]').setValue('2026-12-01')
    await wrapper.get('[data-test="revenue-end-date"]').setValue('2026-09-02')
    await wrapper.get('[data-test="query-revenue-range"]').trigger('click')

    expect(wrapper.get('[data-test="revenue-range-error"]').text()).toContain('开始日期不能晚于结束日期')
  })

  it('维护开关把新的维护状态通知给根页面', async () => {
    const wrapper = mount(AdminConsole, { props: { section: 'overview', maintenanceEnabled: false } })

    await wrapper.get('[data-test="maintenance-toggle"]').trigger('click')

    expect(wrapper.emitted('maintenance-change')).toEqual([[true]])
  })
})
