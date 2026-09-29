import { describe, expect, it, vi } from 'vitest'
import { adminApi } from './admin-api'

describe('管理员 API 封装', () => {
  it('按约定请求总览数据', async () => {
    const requester = vi.fn().mockResolvedValue({ ok: true })

    await adminApi.getOverview(requester)

    expect(requester).toHaveBeenCalledWith('/admin/overview')
  })

  it('用户列表带分页和关键字参数', async () => {
    const requester = vi.fn().mockResolvedValue({ items: [] })

    await adminApi.getUsers({ page: 2, pageSize: 20, keyword: '果' }, requester)

    expect(requester).toHaveBeenCalledWith('/admin/users?page=2&pageSize=20&keyword=%E6%9E%9C')
  })

  it('价格更新和用户状态更新使用 PATCH 请求', async () => {
    const requester = vi.fn().mockResolvedValue({ saved: true })

    await adminApi.updateItemPrice('revive-card', 777, requester)
    await adminApi.updateUserStatus(12, false, requester)

    expect(requester).toHaveBeenNthCalledWith(1, '/admin/items/revive-card/price', {
      method: 'PATCH',
      body: JSON.stringify({ price: 777 }),
    })
    expect(requester).toHaveBeenNthCalledWith(2, '/admin/users/12/status', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    })
  })

  it('日志和营业额支持筛选参数', async () => {
    const requester = vi.fn().mockResolvedValue({ items: [] })

    await adminApi.getLogs({ page: 1, pageSize: 10, type: 'system' }, requester)
    await adminApi.getRevenue('6m', requester)

    expect(requester).toHaveBeenNthCalledWith(1, '/admin/logs?page=1&pageSize=10&type=system')
    expect(requester).toHaveBeenNthCalledWith(2, '/admin/revenue?range=6m')
  })

  it('封装玩家游戏日志、Bug 反馈和维护开关接口', async () => {
    const requester = vi.fn().mockResolvedValue({})

    await adminApi.getPlayerGames(9, { page: 2, pageSize: 10 }, requester)
    await adminApi.getFeedback({ page: 1, pageSize: 20, status: 'pending' }, requester)
    await adminApi.updateFeedbackStatus(3, 'resolved', requester)
    await adminApi.updateMaintenance(true, '服务升级中', requester)

    expect(requester).toHaveBeenNthCalledWith(1, '/admin/users/9/games?page=2&pageSize=10')
    expect(requester).toHaveBeenNthCalledWith(2, '/admin/feedback?page=1&pageSize=20&status=pending')
    expect(requester).toHaveBeenNthCalledWith(3, '/admin/feedback/3/status', { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) })
    expect(requester).toHaveBeenNthCalledWith(4, '/admin/system/maintenance', { method: 'PATCH', body: JSON.stringify({ enabled: true, message: '服务升级中' }) })
  })

  it('按玩家、分页和类型查询不可缺失的审计日志', async () => {
    const requester = vi.fn().mockResolvedValue({ items: [] })

    await adminApi.getPlayerAuditLogs(9, { page: 2, pageSize: 10, type: 'account' }, requester)

    expect(requester).toHaveBeenCalledWith('/admin/users/9/audit-logs?page=2&pageSize=10&type=account')
  })

  it('封装充值商品查询、新增、修改和二维码上传接口', async () => {
    const requester = vi.fn().mockResolvedValue({})
    const payload = { name: '1000 金币', price: 1, enabled: true }
    const qrFile = new File(['qr'], 'qr.png', { type: 'image/png' })

    await adminApi.getRechargeProducts(requester)
    await adminApi.createRechargeProduct(payload, requester)
    await adminApi.updateRechargeProduct('coins-1000', { price: 2 }, requester)
    await adminApi.uploadRechargeQrCode('coins-1000', qrFile, requester)

    expect(requester).toHaveBeenNthCalledWith(1, '/admin/recharge/products')
    expect(requester).toHaveBeenNthCalledWith(2, '/admin/recharge/products', {
      method: 'POST', body: JSON.stringify(payload),
    })
    expect(requester).toHaveBeenNthCalledWith(3, '/admin/recharge/products/coins-1000', {
      method: 'PATCH', body: JSON.stringify({ price: 2 }),
    })
    expect(requester.mock.calls[3][0]).toBe('/admin/recharge/products/coins-1000/qr-code')
    expect(requester.mock.calls[3][1].method).toBe('POST')
    expect(requester.mock.calls[3][1].body).toBeInstanceOf(FormData)
  })

  it('封装特殊权限查询、密码确认和幂等金币赠送接口', async () => {
    const requester = vi.fn().mockResolvedValue({})

    await adminApi.getPlayerPermissions({ page: 2, pageSize: 6, keyword: '水果' }, requester)
    await adminApi.updateInfiniteEnergy(9, true, 'admin123456', requester)
    await adminApi.grantPlayerCoins(9, 'grant-operation-1', requester)

    expect(requester).toHaveBeenNthCalledWith(1, '/admin/permissions?page=2&pageSize=6&keyword=%E6%B0%B4%E6%9E%9C')
    expect(requester).toHaveBeenNthCalledWith(2, '/admin/users/9/permissions/infinite-energy', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true, adminPassword: 'admin123456' }),
    })
    expect(requester).toHaveBeenNthCalledWith(3, '/admin/users/9/coin-grants', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'grant-operation-1' },
      body: JSON.stringify({ amount: 1000 }),
    })
  })

  it('封装通知发布记录和发布接口', async () => {
    const requester = vi.fn().mockResolvedValue({})
    const payload = { title: '更新通知', content: '版本已更新', audienceType: 'selected', recipientIds: [1, 3] }

    await adminApi.getNotificationPublications({ page: 2, pageSize: 10 }, requester)
    await adminApi.publishNotification(payload, requester)

    expect(requester).toHaveBeenNthCalledWith(1, '/admin/notifications/publications?page=2&pageSize=10')
    expect(requester).toHaveBeenNthCalledWith(2, '/admin/notifications/publications', {
      method: 'POST', body: JSON.stringify(payload),
    })
  })
})
