import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PlayerAuditLog from './PlayerAuditLog.vue'

const player = { id: 9, username: '水果达人', joined: '2026-09-01', level: '普通 5 / 困难 3', coins: '12,480' }
const records = [
  { id: 'audit-1', category: 'game', categoryLabel: '对局记录', action: '普通模式第 4 关结算', detail: '得分 1,260 · 通关 · 获得 146 金币', time: '今天 14:20', balanceBefore: 12334, balanceAfter: 12480 },
  { id: 'audit-2', category: 'account', categoryLabel: '账户消费', action: '购买复活卡', detail: '复活卡 ×1 · 商店兑换', time: '今天 13:48', balanceBefore: 12934, balanceAfter: 12334 },
  { id: 'audit-3', category: 'item', categoryLabel: '道具使用', action: '使用延时 10 秒', detail: '普通模式第 4 关 · 道具已扣除', time: '今天 14:00', balanceBefore: 12934, balanceAfter: 12934 },
]

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('PlayerAuditLog', () => {
  it('异步加载玩家完整审计日志，并支持账户消费筛选和分页', async () => {
    const loader = vi.fn().mockResolvedValue({ items: records, page: 1, pageSize: 6, total: 12 })
    const wrapper = mount(PlayerAuditLog, { propsData: { player, loader } })
    await flushPromises()

    expect(loader).toHaveBeenCalledWith(9, { page: 1, pageSize: 6, type: 'all' })
    expect(wrapper.get('[data-test="audit-player-name"]').text()).toBe('水果达人')
    expect(wrapper.text()).toContain('发生时间')
    expect(wrapper.text()).toContain('得分 1,260')
    expect(wrapper.text()).toContain('购买复活卡')
    expect(wrapper.text()).toContain('使用延时 10 秒')
    expect(wrapper.get('[data-test="audit-pagination"]').classes()).toContain('pagination--fixed')
    expect(wrapper.get('[data-test="audit-previous-page"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-test="audit-filter-account"]').trigger('click')
    await flushPromises()
    expect(loader).toHaveBeenLastCalledWith(9, { page: 1, pageSize: 6, type: 'account' })

    await wrapper.get('[data-test="audit-next-page"]').trigger('click')
    await flushPromises()
    expect(loader).toHaveBeenLastCalledWith(9, { page: 2, pageSize: 6, type: 'account' })

    await wrapper.get('[data-test="back-to-users"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
