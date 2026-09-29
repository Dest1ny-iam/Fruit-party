import { describe, expect, it, vi } from 'vitest'
import { gameApi } from './game-api'

describe('游戏业务 API 封装', () => {
  it('使用后端认证和玩家摘要路由', async () => {
    const request = vi.fn().mockResolvedValue({})

    await gameApi.login({ username: 'fruiter', password: 'StrongPass123' }, request)
    await gameApi.getPlayerSummary(request)

    expect(request).toHaveBeenNthCalledWith(1, '/auth/login', expect.objectContaining({ method: 'POST' }))
    expect(request).toHaveBeenNthCalledWith(2, '/player/summary')
  })

  it('按分页参数请求指定模式关卡', async () => {
    const request = vi.fn().mockResolvedValue({ items: [] })
    await gameApi.getLevels('hard', 2, 10, request)

    expect(request).toHaveBeenCalledWith('/levels?mode=hard&page=2&pageSize=10')
  })

  it('创建游戏和提交结算使用统一 games 路径', async () => {
    const request = vi.fn().mockResolvedValue({ gameId: 'g-1' })
    await gameApi.startRound({ mode: 'hard', level: 1 }, request)
    await gameApi.submitRound('g-1', { score: 1200 }, request)

    expect(request).toHaveBeenNthCalledWith(1, '/games/start', {
      method: 'POST',
      body: JSON.stringify({ mode: 'hard', level: 1 }),
    })
    expect(request).toHaveBeenNthCalledWith(2, '/games/g-1/settlement', {
      method: 'POST',
      body: JSON.stringify({ score: 1200 }),
    })
  })

  it('封装仓库查询、使用和出售接口', async () => {
    const request = vi.fn().mockResolvedValue({})
    await gameApi.getInventory(request)
    await gameApi.useInventoryItem('energy-pack', request)
    await gameApi.sellInventoryItem('revive-card', request)

    expect(request).toHaveBeenNthCalledWith(1, '/inventory')
    expect(request).toHaveBeenNthCalledWith(2, '/inventory/energy-pack/use', { method: 'POST' })
    expect(request).toHaveBeenNthCalledWith(3, '/inventory/revive-card/sell', { method: 'POST' })
  })

  it('封装商店购买接口', async () => {
    const request = vi.fn().mockResolvedValue({ coins: 400 })
    await gameApi.buyItem('time-plus', 2, request)

    expect(request).toHaveBeenCalledWith('/shop/items/time-plus/buy', {
      method: 'POST',
      body: JSON.stringify({ quantity: 2 }),
    })
  })

  it('封装通知读取、已读和软删除接口', async () => {
    const request = vi.fn().mockResolvedValue({})
    await gameApi.getNotifications(2, 8, request)
    await gameApi.markNotificationRead(7, request)
    await gameApi.markAllNotificationsRead(request)
    await gameApi.deleteNotification(7, request)
    await gameApi.deleteReadNotifications(request)

    expect(request).toHaveBeenNthCalledWith(1, '/notifications?page=2&pageSize=8')
    expect(request).toHaveBeenNthCalledWith(2, '/notifications/7/read', { method: 'POST' })
    expect(request).toHaveBeenNthCalledWith(3, '/notifications/read-all', { method: 'POST' })
    expect(request).toHaveBeenNthCalledWith(4, '/notifications/7', { method: 'DELETE' })
    expect(request).toHaveBeenNthCalledWith(5, '/notifications/read', { method: 'DELETE' })
  })

  it('封装充值商品与订单接口', async () => {
    const request = vi.fn().mockResolvedValue({})
    await gameApi.getRechargeProducts(request)
    await gameApi.createRechargeOrder('coins-1000', request)
    await gameApi.getRechargeOrder('order-1', request)

    expect(request).toHaveBeenNthCalledWith(1, '/recharge/products')
    expect(request).toHaveBeenNthCalledWith(2, '/recharge/orders', {
      method: 'POST',
      body: JSON.stringify({ productId: 'coins-1000' }),
    })
    expect(request).toHaveBeenNthCalledWith(3, '/recharge/orders/order-1')
  })
})
