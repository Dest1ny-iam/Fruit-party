import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AdminPermissionCenter from './AdminPermissionCenter.vue'

const players = [
  { id: 1, username: '水果达人', joined: '2026-09-01', coins: 12480, infiniteEnergy: false },
  { id: 2, username: '切切乐', joined: '2026-09-04', coins: 2310, infiniteEnergy: true },
]

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

function mountCenter(overrides = {}) {
  return mount(AdminPermissionCenter, {
    propsData: {
      loader: vi.fn().mockResolvedValue({ items: players, page: 1, pageSize: 6, total: 2 }),
      permissionUpdater: vi.fn().mockResolvedValue({ ...players[0], infiniteEnergy: true }),
      coinGranter: vi.fn().mockResolvedValue({ ...players[0], coins: 13480 }),
      operationIdFactory: () => 'operation-1',
      ...overrides,
    },
  })
}

describe('AdminPermissionCenter', () => {
  it('加载玩家权限列表并支持模糊查询和分页参数', async () => {
    const loader = vi.fn().mockResolvedValue({ items: players, page: 1, pageSize: 6, total: 2 })
    const wrapper = mountCenter({ loader })
    await flushPromises()

    expect(wrapper.get('[data-test="permission-row-1"]').text()).toContain('水果达人')
    expect(wrapper.get('[data-test="permission-toggle-1"]').classes()).toContain('permission-button--grant')
    expect(wrapper.get('[data-test="permission-toggle-2"]').classes()).toContain('permission-button--revoke')
    await wrapper.get('[data-test="permission-search"]').setValue('水果')
    await wrapper.get('[data-test="permission-search-submit"]').trigger('click')
    await flushPromises()

    expect(loader).toHaveBeenLastCalledWith({ page: 1, pageSize: 6, keyword: '水果' })
    expect(wrapper.get('[data-test="permissions-pagination"]').classes()).toContain('pagination--fixed')
    expect(wrapper.get('[data-test="permissions-previous"]').attributes('disabled')).toBeDefined()
  })

  it('授予特殊权限前要求重新输入管理员密码', async () => {
    const permissionUpdater = vi.fn().mockResolvedValue({ ...players[0], infiniteEnergy: true })
    const wrapper = mountCenter({ permissionUpdater })
    await flushPromises()

    await wrapper.get('[data-test="permission-toggle-1"]').trigger('click')
    expect(wrapper.get('[data-test="admin-password-dialog"]').exists()).toBe(true)
    await wrapper.get('[data-test="permission-admin-password"]').setValue('admin123456')
    await wrapper.get('[data-test="confirm-permission-change"]').trigger('click')
    await flushPromises()

    expect(permissionUpdater).toHaveBeenCalledWith(1, {
      enabled: true,
      adminPassword: 'admin123456',
    })
    expect(wrapper.get('[data-test="permission-row-1"]').text()).toContain('无限能量')
  })

  it('赠送按钮每次固定发送 1000 金币并携带幂等操作编号', async () => {
    const coinGranter = vi.fn().mockResolvedValue({ ...players[0], coins: 13480 })
    const wrapper = mountCenter({ coinGranter })
    await flushPromises()

    await wrapper.get('[data-test="grant-coins-1"]').trigger('click')
    await flushPromises()

    expect(coinGranter).toHaveBeenCalledWith(1, { operationId: 'operation-1' })
    expect(wrapper.get('[data-test="permission-row-1"]').text()).toContain('13,480')
  })
})
