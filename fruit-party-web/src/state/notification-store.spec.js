import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteDemoNotification,
  deleteReadDemoNotifications,
  loadDemoNotifications,
  markAllDemoNotificationsRead,
  markDemoNotificationRead,
} from './notification-store'
import { ENDLESS_UNLOCK_LEVEL } from '../game/progressionRules'

describe('通知演示状态', () => {
  beforeEach(() => window.localStorage.clear())

  it('无尽模式通知使用集中配置的解锁关卡', () => {
    const endlessNotice = loadDemoNotifications().find((item) => item.title === '无尽模式规则更新')

    expect(endlessNotice?.content).toContain(`第 ${ENDLESS_UNLOCK_LEVEL} 关`)
  })

  it('把单条和全部已读状态保存在本地，模拟后端持久化结果', () => {
    markDemoNotificationRead(1)
    expect(loadDemoNotifications().find((item) => item.id === 1)?.read).toBe(true)

    markAllDemoNotificationsRead()
    expect(loadDemoNotifications().every((item) => item.read)).toBe(true)
  })

  it('删除单条或全部已读通知后刷新也不会重新出现', () => {
    deleteDemoNotification(3)
    expect(loadDemoNotifications().some((item) => item.id === 3)).toBe(false)

    markAllDemoNotificationsRead()
    deleteReadDemoNotifications()
    expect(loadDemoNotifications()).toEqual([])
  })
})
