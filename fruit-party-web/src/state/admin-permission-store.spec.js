import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPermissionStore,
  getCachedPlayerBenefits,
  getPermissionAuditLogs,
  grantPlayerCoins,
  listPermissionPlayers,
  updateInfiniteEnergyPermission,
} from './admin-permission-store'

describe('后台特殊权限本地仓库', () => {
  beforeEach(() => clearPermissionStore())

  it('按玩家名称模糊查询并返回稳定分页结构', async () => {
    const result = await listPermissionPlayers({ page: 1, pageSize: 2, keyword: '果' })

    expect(result).toMatchObject({ page: 1, pageSize: 2 })
    expect(result.total).toBeGreaterThanOrEqual(2)
    expect(result.items).toHaveLength(2)
    expect(result.items.every((player) => player.username.includes('果'))).toBe(true)
  })

  it('无限能量授权和撤销必须通过管理员密码校验', async () => {
    await expect(updateInfiniteEnergyPermission(1, {
      enabled: true,
      adminPassword: 'wrong-password',
    })).rejects.toMatchObject({ code: 'INVALID_ADMIN_PASSWORD' })

    const granted = await updateInfiniteEnergyPermission(1, {
      enabled: true,
      adminPassword: 'admin123456',
    })
    expect(granted.infiniteEnergy).toBe(true)
    expect(getCachedPlayerBenefits('水果达人')).toMatchObject({ infiniteEnergy: true })

    const revoked = await updateInfiniteEnergyPermission(1, {
      enabled: false,
      adminPassword: 'admin123456',
    })
    expect(revoked.infiniteEnergy).toBe(false)
  })

  it('固定赠送 1000 金币并用操作编号避免重复到账', async () => {
    const first = await grantPlayerCoins(1, { operationId: 'grant-001' })
    const duplicate = await grantPlayerCoins(1, { operationId: 'grant-001' })

    expect(first.coins).toBe(13480)
    expect(duplicate).toMatchObject({ coins: 13480, duplicate: true })
    expect(getCachedPlayerBenefits('水果达人').coins).toBe(13480)
    expect(getPermissionAuditLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: '赠送玩家金币', detail: '管理员赠送 1000 金币' }),
    ]))
  })
})
