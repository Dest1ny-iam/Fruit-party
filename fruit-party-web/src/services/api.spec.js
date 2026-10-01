import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './api.js'

describe('API client', () => {
  it('sends the stored bearer token and unwraps server data', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { player: { username: 'tester' } }, error: null }),
    })
    const client = createApiClient({ fetcher, getToken: () => 'signed-token' })

    await expect(client.getPlayerState()).resolves.toEqual({ player: { username: 'tester' } })
    expect(fetcher).toHaveBeenCalledWith('/api/me/state', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer signed-token' }),
    }))
  })

  it('exposes server validation messages instead of replacing them with fixture state', async () => {
    const client = createApiClient({
      fetcher: async () => ({ ok: false, json: async () => ({ data: null, error: { code: 'USERNAME_TAKEN', message: '用户名已被注册，请重新取名' } }) }),
      getToken: () => null,
    })

    await expect(client.register({ username: '水果达人', password: 'Player123', acceptedTerms: true }))
      .rejects.toMatchObject({ code: 'USERNAME_TAKEN', message: '用户名已被注册，请重新取名' })
  })

  it('maps shop, notification, and recharge calls onto server APIs', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], error: null }) })
    const client = createApiClient({ fetcher, getToken: () => 'signed-token' })

    await client.getShopItems()
    await client.purchaseItem({ itemId: 2, quantity: 3, requestId: 'request-001' })
    await client.getNotifications()
    await client.readNotification(8)
    await client.getRechargeProducts()
    await client.createRechargeOrder(4)

    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      '/api/shop/items', '/api/shop/purchases', '/api/notifications', '/api/notifications/8/read', '/api/recharge-products', '/api/recharge-orders',
    ])
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ itemId: 2, quantity: 3, requestId: 'request-001' }) })
  })

  it('maps session-bound endless item and revive calls', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {}, error: null }) })
    const client = createApiClient({ fetcher, getToken: () => 'signed-token' })

    await client.activateGameItem('session/1', 'bomb-shield')
    await client.reviveGameSession('session/1')

    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      '/api/game/sessions/session%2F1/items/bomb-shield/activate',
      '/api/game/sessions/session%2F1/revive',
    ])
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST' })
  })

  it('maps the paged wallet ledger endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items: [], page: 2, pageSize: 10, total: 0 }, error: null }) })
    const client = createApiClient({ fetcher, getToken: () => 'signed-token' })

    await expect(client.getWalletLedger({ page: 2, pageSize: 10 })).resolves.toMatchObject({ page: 2, pageSize: 10 })
    expect(fetcher).toHaveBeenCalledWith('/api/me/wallet/ledger?page=2&pageSize=10', expect.any(Object))
  })

  it('maps administrative reads and mutations to the MySQL API contract', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], error: null }) })
    const client = createApiClient({ fetcher, getToken: () => 'admin-token' })

    await client.getAdminDashboard()
    await client.getAdminPlayers()
    await client.setAdminPlayerStatus(9, true)
    await client.getAdminItems()
    await client.updateAdminItemPrice(6, 480)

    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      '/api/admin/dashboard', '/api/admin/players', '/api/admin/players/9/status', '/api/admin/items', '/api/admin/items/6/price',
    ])
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ disabled: true }) })
    expect(fetcher.mock.calls[4][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ priceCoins: 480 }) })
  })

  it('maps administrator audit and revenue queries to the MySQL API contract', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], error: null }) })
    const client = createApiClient({ fetcher, getToken: () => 'admin-token' })

    await client.getAdminAuditLogs({ type: 'admin', page: 2, pageSize: 6 })
    await client.getAdminRevenue({ startDate: '2026-09-01', endDate: '2026-09-30', aggregation: 'day' })

    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      '/api/admin/audit-logs?type=admin&page=2&pageSize=6',
      '/api/admin/revenue?startDate=2026-09-01&endDate=2026-09-30&aggregation=day',
    ])
  })

  it('maps a selected player audit query to the MySQL API contract', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], error: null }) })
    const client = createApiClient({ fetcher, getToken: () => 'admin-token' })

    await client.getAdminPlayerAuditLogs(8, { type: 'game', page: 2, pageSize: 6 })

    expect(fetcher).toHaveBeenCalledWith('/api/admin/players/8/audit-logs?type=game&page=2&pageSize=6', expect.any(Object))
  })

  it('maps permission, notification, and recharge administration to MySQL endpoints', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { items: [{ id: 8, createdAt: '2026-09-28T00:00:00.000Z' }], page: 1, pageSize: 6, total: 1 }, error: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], error: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 2, displayName: '千枚金币', description: '真实商品', priceCents: 100, benefits: { benefitType: 'coins', benefitAmount: 1000 }, qrCodeUrl: 'https://example.test/qr.png', enabled: true, displayOrder: 1 }], error: null }) })
    const client = createApiClient({ fetcher, getToken: () => 'admin-token' })

    await expect(client.getAdminPermissions()).resolves.toMatchObject({ items: [expect.objectContaining({ joined: '2026-09-28' })] })
    await client.publishAdminNotification({ title: '维护', content: '完成', audienceType: 'all', recipientIds: [] })
    await expect(client.getAdminRechargeProducts()).resolves.toEqual([expect.objectContaining({ id: '2', name: '千枚金币', benefitType: 'coins' })])

    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      '/api/admin/permissions?page=1&pageSize=6&keyword=',
      '/api/admin/notifications',
      '/api/admin/recharge-products',
    ])
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ title: '维护', body: '完成', recipientIds: null }) })
  })

  it('accepts no-content success responses for notification writes', async () => {
    const client = createApiClient({ fetcher: async () => ({ ok: true, status: 204, json: vi.fn() }), getToken: () => 'signed-token' })

    await expect(client.readNotification(8)).resolves.toBeNull()
  })

  it('turns an HTML proxy response into a displayable API error instead of exposing a JSON parsing exception', async () => {
    const client = createApiClient({
      fetcher: async () => ({ ok: false, status: 404, headers: new Headers({ 'content-type': 'text/html' }), text: async () => '<!DOCTYPE html>' }),
      getToken: () => 'signed-token',
    })

    await expect(client.getShopItems()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE', message: '服务连接异常，请刷新页面后重试' })
  })
})
