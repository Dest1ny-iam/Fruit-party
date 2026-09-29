import { describe, expect, it } from 'vitest'
import {
  canUseInternalTesting,
  isInternalTestingFeatureEnabled,
  resolveDemoRole,
} from './internal-testing'

describe('内测模式权限配置', () => {
  it('只在总开关开启且账号密码正确时识别内测角色', () => {
    expect(resolveDemoRole('tester', 'test123456', true)).toBe('tester')
    expect(resolveDemoRole('tester', 'wrong', true)).toBe('player')
    expect(resolveDemoRole('tester', 'test123456', false)).toBe('player')
  })

  it('继续识别管理员账号，其他账号保持普通玩家角色', () => {
    expect(resolveDemoRole('admin', 'admin123456', true)).toBe('admin')
    expect(resolveDemoRole('fruit-player', '12345678', true)).toBe('player')
  })

  it('环境变量只有显式设为 false 才关闭内测功能', () => {
    expect(isInternalTestingFeatureEnabled({})).toBe(true)
    expect(isInternalTestingFeatureEnabled({ VITE_ENABLE_INTERNAL_TEST_MODE: 'true' })).toBe(true)
    expect(isInternalTestingFeatureEnabled({ VITE_ENABLE_INTERNAL_TEST_MODE: 'false' })).toBe(false)
  })

  it('内测角色仍必须受全局开关约束', () => {
    expect(canUseInternalTesting({ role: 'tester' }, true)).toBe(true)
    expect(canUseInternalTesting({ role: 'tester' }, false)).toBe(false)
    expect(canUseInternalTesting({ role: 'player' }, true)).toBe(false)
  })
})
