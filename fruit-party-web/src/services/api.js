export class ApiError extends Error {
  constructor({ code = 'REQUEST_FAILED', message = '请求失败', status = 0 }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function createApiClient({ fetcher = window.fetch.bind(window), getToken = () => localStorage.getItem('fruit-party-token') } = {}) {
  async function request(path, options = {}) {
    const token = getToken()
    const response = await fetcher(path, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    if (response.status === 204) return null
    const contentType = response.headers?.get?.('content-type') || ''
    if (contentType && !contentType.includes('application/json')) {
      throw new ApiError({ code: 'INVALID_API_RESPONSE', message: '服务连接异常，请刷新页面后重试', status: response.status })
    }
    let payload
    try { payload = await response.json() } catch {
      throw new ApiError({ code: 'INVALID_API_RESPONSE', message: '服务连接异常，请刷新页面后重试', status: response.status })
    }
    if (!response.ok) throw new ApiError({ ...payload.error, status: response.status })
    return payload.data
  }

  return {
    login: (credentials) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (credentials) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(credentials) }),
    getPlayerState: () => request('/api/me/state'),
    updateProfile: (profile) => request('/api/me/profile', { method: 'PATCH', body: JSON.stringify(profile) }),
    setTestingMode: (enabled) => request('/api/me/testing-mode', { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    getLeaderboards: () => request('/api/leaderboards'),
    getShopItems: () => request('/api/shop/items'),
    purchaseItem: (purchase) => request('/api/shop/purchases', { method: 'POST', body: JSON.stringify(purchase) }),
    getInventory: () => request('/api/me/inventory'),
    useInventoryItem: (itemKey) => request('/api/me/inventory/use', { method: 'POST', body: JSON.stringify({ itemKey }) }),
    getNotifications: () => request('/api/notifications'),
    readNotification: (notificationId) => request(`/api/notifications/${notificationId}/read`, { method: 'PATCH' }),
    deleteNotification: (notificationId) => request(`/api/notifications/${notificationId}`, { method: 'DELETE' }),
    getRechargeProducts: () => request('/api/recharge-products'),
    createRechargeOrder: (productId) => request('/api/recharge-orders', { method: 'POST', body: JSON.stringify({ productId }) }),
    getAdminDashboard: () => request('/api/admin/dashboard'),
    getAdminPlayers: () => request('/api/admin/players'),
    setAdminPlayerStatus: (playerId, disabled) => request(`/api/admin/players/${playerId}/status`, { method: 'PATCH', body: JSON.stringify({ disabled }) }),
    getAdminItems: () => request('/api/admin/items'),
    updateAdminItemPrice: (itemId, priceCoins) => request(`/api/admin/items/${itemId}/price`, { method: 'PATCH', body: JSON.stringify({ priceCoins }) }),
    getAdminAuditLogs: ({ type = 'all', page = 1, pageSize = 20 } = {}) => request(`/api/admin/audit-logs?${new URLSearchParams({ type, page: String(page), pageSize: String(pageSize) })}`),
    getAdminPlayerAuditLogs: (playerId, { type = 'all', page = 1, pageSize = 20 } = {}) => request(`/api/admin/players/${playerId}/audit-logs?${new URLSearchParams({ type, page: String(page), pageSize: String(pageSize) })}`),
    getAdminRevenue: ({ startDate, endDate, aggregation }) => request(`/api/admin/revenue?${new URLSearchParams({ startDate, endDate, aggregation })}`),
    getAdminPermissions: ({ page = 1, pageSize = 6, keyword = '' } = {}) => request(`/api/admin/permissions?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), keyword })}`).then((result) => ({
      ...result,
      items: result.items.map((player) => ({ ...player, joined: String(player.createdAt || '').slice(0, 10) })),
    })),
    updateAdminInfiniteEnergy: (playerId, { enabled, adminPassword }) => request(`/api/admin/players/${playerId}/privileges`, { method: 'PATCH', body: JSON.stringify({ adminPassword, privileges: { infiniteEnergy: enabled, infiniteCoins: false, unlockAllLevels: false } }) }),
    grantAdminCoins: (playerId, { operationId }) => request(`/api/admin/players/${playerId}/coin-grants`, { method: 'POST', body: JSON.stringify({ operationId }) }),
    getAdminNotificationPublications: () => request('/api/admin/notifications'),
    publishAdminNotification: (payload) => request('/api/admin/notifications', { method: 'POST', body: JSON.stringify({ title: payload.title, body: payload.content, recipientIds: payload.audienceType === 'selected' ? payload.recipientIds : null }) }),
    getAdminRechargeProducts: () => request('/api/admin/recharge-products').then((products) => products.map((product) => ({
      id: String(product.id), name: product.displayName, price: Number(product.priceCents) / 100,
      benefitType: product.benefits.benefitType, benefitAmount: product.benefits.benefitAmount,
      benefitName: product.benefits.benefitName || '', description: product.description,
      enabled: product.enabled, sortOrder: product.displayOrder, qrCodeImage: product.qrCodeUrl || '',
    }))),
    saveAdminRechargeProduct: (product) => {
      const payload = {
        displayName: product.name, description: product.description, priceCents: Math.round(Number(product.price) * 100),
        qrCodeUrl: product.qrCodeImage, enabled: product.enabled !== false, displayOrder: Number(product.sortOrder),
        benefits: { benefitType: product.benefitType, benefitAmount: Number(product.benefitAmount), benefitName: product.benefitName || '' },
      }
      const path = product.id ? `/api/admin/recharge-products/${product.id}` : '/api/admin/recharge-products'
      return request(path, { method: product.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }).then((saved) => ({
        id: String(saved.id), name: saved.displayName, price: Number(saved.priceCents) / 100,
        benefitType: saved.benefits.benefitType, benefitAmount: saved.benefits.benefitAmount,
        benefitName: saved.benefits.benefitName || '', description: saved.description,
        enabled: saved.enabled, sortOrder: saved.displayOrder, qrCodeImage: saved.qrCodeUrl || '',
      }))
    },
    enterGame: (entry) => request('/api/game/entries', { method: 'POST', body: JSON.stringify(entry) }),
    settleGame: (settlement) => request('/api/game/settlements', { method: 'POST', body: JSON.stringify(settlement) }),
    openPlayerStateStream(onState, onLeaderboards = () => {}, onAccountDisabled = () => {}, onError = () => {}) {
      const stream = new EventSource('/api/events')
      stream.addEventListener('player-state', (event) => onState(JSON.parse(event.data)))
      stream.addEventListener('leaderboards', (event) => onLeaderboards(JSON.parse(event.data)))
      stream.addEventListener('account-disabled', onAccountDisabled)
      stream.addEventListener('error', onError)
      return () => stream.close()
    },
  }
}

export const apiClient = createApiClient()
