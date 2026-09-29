import { beforeEach, describe, expect, it } from 'vitest'
import { clearSystemStatus, loadSystemStatus, saveSystemStatus } from './system-status'

describe('系统维护状态', () => {
  beforeEach(() => clearSystemStatus())

  it('默认不在维护中', () => {
    expect(loadSystemStatus()).toMatchObject({ maintenanceEnabled: false })
  })

  it('保存维护开关后可以恢复给登录页和路由守卫', () => {
    saveSystemStatus({ maintenanceEnabled: true, message: '正在更新水果引擎' })

    expect(loadSystemStatus()).toMatchObject({ maintenanceEnabled: true, message: '正在更新水果引擎' })
  })
})
