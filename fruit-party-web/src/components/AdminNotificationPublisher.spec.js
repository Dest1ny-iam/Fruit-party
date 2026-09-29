import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AdminNotificationPublisher from './AdminNotificationPublisher.vue'

const players = [
  { id: 1, username: '水果达人', enabled: true },
  { id: 2, username: '一刀两半', enabled: true },
  { id: 3, username: '蜜瓜骑士', enabled: false },
]

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('AdminNotificationPublisher', () => {
  it('展示发布记录并通过二次确认向全体玩家发布', async () => {
    const publisher = vi.fn().mockResolvedValue({ id: 'notice-new' })
    const loader = vi.fn().mockResolvedValue([{ id: 'notice-1', title: '维护完成', audienceLabel: '全体玩家', recipientCount: 12846, readCount: 8640, sentAt: '今天 09:00', status: 'sent' }])
    const wrapper = mount(AdminNotificationPublisher, { propsData: { players, publisher, loader } })
    await flushPromises()

    expect(wrapper.get('[data-test="notification-history"]').text()).toContain('维护完成')
    await wrapper.get('[data-test="open-notification-publisher"]').trigger('click')
    await wrapper.get('[data-test="notification-title"]').setValue('全服更新')
    await wrapper.get('[data-test="notification-content"]').setValue('新版本已经上线。')
    await wrapper.get('[data-test="submit-notification"]').trigger('click')
    expect(wrapper.get('[data-test="broadcast-confirmation"]').exists()).toBe(true)

    await wrapper.get('[data-test="confirm-broadcast"]').trigger('click')
    await flushPromises()
    expect(publisher).toHaveBeenCalledWith(expect.objectContaining({
      title: '全服更新',
      content: '新版本已经上线。',
      audienceType: 'all',
      recipientIds: [],
    }))
  })

  it('指定玩家模式支持搜索、勾选并只提交选中的玩家', async () => {
    const publisher = vi.fn().mockResolvedValue({ id: 'notice-selected' })
    const wrapper = mount(AdminNotificationPublisher, {
      propsData: { players, publisher, loader: () => Promise.resolve([]) },
    })
    await flushPromises()

    await wrapper.get('[data-test="open-notification-publisher"]').trigger('click')
    await wrapper.get('[data-test="audience-selected"]').trigger('click')
    await wrapper.get('[data-test="recipient-search"]').setValue('蜜瓜')
    expect(wrapper.find('[data-test="recipient-1"]').exists()).toBe(false)
    await wrapper.get('[data-test="recipient-3"]').setChecked(true)
    await wrapper.get('[data-test="notification-title"]').setValue('账号提醒')
    await wrapper.get('[data-test="notification-content"]').setValue('请查看账号状态。')
    await wrapper.get('[data-test="submit-notification"]').trigger('click')
    await flushPromises()

    expect(publisher).toHaveBeenCalledWith(expect.objectContaining({
      audienceType: 'selected',
      recipientIds: [3],
      recipientNames: ['蜜瓜骑士'],
    }))
    expect(wrapper.find('[data-test="broadcast-confirmation"]').exists()).toBe(false)
  })

  it('指定玩家未勾选收件人时阻止发布', async () => {
    const publisher = vi.fn()
    const wrapper = mount(AdminNotificationPublisher, {
      propsData: { players, publisher, loader: () => Promise.resolve([]) },
    })
    await flushPromises()

    await wrapper.get('[data-test="open-notification-publisher"]').trigger('click')
    await wrapper.get('[data-test="audience-selected"]').trigger('click')
    await wrapper.get('[data-test="notification-title"]').setValue('提醒')
    await wrapper.get('[data-test="notification-content"]').setValue('通知内容')
    await wrapper.get('[data-test="submit-notification"]').trigger('click')

    expect(wrapper.get('[data-test="notification-publish-error"]').text()).toContain('至少选择一名玩家')
    expect(publisher).not.toHaveBeenCalled()
  })
})
