import { beforeEach, describe, expect, it } from 'vitest'
import { appendCoinLedger, clearSession, hasAdminSession, hasSession, loadSession, saveSession, STORAGE_KEY } from './player-session'

describe('玩家临时会话存储', () => {
  beforeEach(() => window.localStorage.clear())

  it('保存后可以恢复登录、进度、能量和金币', () => {
    saveSession({ authenticated: true, username: 'tester', highestLevel: 3, highestCompletedLevel: 2, energy: 4, coins: 120 })

    expect(loadSession()).toMatchObject({ authenticated: true, username: 'tester', highestLevel: 3, highestCompletedLevel: 2, energy: 4, coins: 120 })
    expect(loadSession().inventory['revive-card']).toBe(0)
    expect(hasSession()).toBe(true)
  })

  it('默认关闭内测模式并能持久化内测角色状态', () => {
    expect(loadSession().internalTestModeEnabled).toBe(false)
    expect(loadSession().infiniteEnergy).toBe(false)

    saveSession({ authenticated: true, role: 'tester', internalTestModeEnabled: true, infiniteEnergy: true })

    expect(loadSession()).toMatchObject({ role: 'tester', internalTestModeEnabled: true, infiniteEnergy: true })
  })

  it('旧会话只把最高关卡视为已解锁，不误判为已经通关', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ highestLevel: 5, highestHardLevel: 3 }))

    expect(loadSession()).toMatchObject({
      highestLevel: 5,
      highestCompletedLevel: 4,
      highestHardLevel: 3,
      highestCompletedHardLevel: 2,
    })
  })

  it('清理会话后路由守卫可以识别为未登录', () => {
    saveSession({ authenticated: true })
    clearSession()

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(hasSession()).toBe(false)
  })

  it('只把管理员角色识别为管理员会话', () => {
    saveSession({ authenticated: true, role: 'player' })
    expect(hasAdminSession()).toBe(false)
    saveSession({ role: 'admin' })
    expect(hasAdminSession()).toBe(true)
  })

  it('保存头像并按时间倒序保留金币收支流水', () => {
    saveSession({ avatar: '🍍' })
    appendCoinLedger({ amount: -320, title: '购买复活卡', occurredAt: '刚刚' })
    appendCoinLedger({ amount: 146, title: '普通模式结算奖励', occurredAt: '刚刚' })

    expect(loadSession().avatar).toBe('🍍')
    expect(loadSession().coinLedger).toEqual([
      { amount: 146, title: '普通模式结算奖励', occurredAt: '刚刚' },
      { amount: -320, title: '购买复活卡', occurredAt: '刚刚' },
    ])
  })
})
