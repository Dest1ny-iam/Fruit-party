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
    getWalletLedger: ({ page = 1, pageSize = 20 } = {}) => request(`/api/me/wallet/ledger?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`),
    getSystemStatus: () => request('/api/system/status'),
    updateProfile: (profile) => request('/api/me/profile', { method: 'PATCH', body: JSON.stringify(profile) }),
    setTestingMode: (enabled) => request('/api/me/testing-mode', { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    getLeaderboards: () => request('/api/leaderboards'),
    getShopItems: () => request('/api/shop/items'),
    purchaseItem: (purchase) => request('/api/shop/purchases', { method: 'POST', body: JSON.stringify(purchase) }),
    getInventory: () => request('/api/me/inventory'),
    useInventoryItem: (itemKey) => request('/api/me/inventory/use', { method: 'POST', body: JSON.stringify({ itemKey }) }),
    activateGameItem: (sessionId, itemKey) => request(`/api/game/sessions/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemKey)}/activate`, { method: 'POST' }),
    reviveGameSession: (sessionId) => request(`/api/game/sessions/${encodeURIComponent(sessionId)}/revive`, { method: 'POST' }),
    getNotifications: () => request('/api/notifications'),
    readNotification: (notificationId) => request(`/api/notifications/${notificationId}/read`, { method: 'PATCH' }),
    deleteNotification: (notificationId) => request(`/api/notifications/${notificationId}`, { method: 'DELETE' }),
    getRechargeProducts: () => request('/api/recharge-products'),
    createRechargeOrder: (productId) => request('/api/recharge-orders', { method: 'POST', body: JSON.stringify({ productId }) }),
    getRechargeOrder: (orderNo) => request(`/api/recharge-orders/${encodeURIComponent(orderNo)}`),
    cancelRechargeOrder: (orderNo) => request(`/api/recharge-orders/${encodeURIComponent(orderNo)}/cancel`, { method: 'POST' }),
    getAdminDashboard: () => request('/api/admin/dashboard'),
    getAdminMaintenance: () => request('/api/admin/system/maintenance'),
    updateAdminMaintenance: ({ enabled, message = '', estimatedEndAt = null }) => request('/api/admin/system/maintenance', { method: 'PATCH', body: JSON.stringify({ enabled, message, estimatedEndAt }) }),
    getAdminPlayers: ({ page, pageSize, keyword = '', joined = '' } = {}) => {
      const hasPaging = page !== undefined || pageSize !== undefined || keyword || joined
      if (!hasPaging) return request('/api/admin/players')
      return request(`/api/admin/players?${new URLSearchParams({ page: String(page || 1), pageSize: String(pageSize || 20), keyword, joined })}`)
    },
    setAdminPlayerStatus: (playerId, disabled) => request(`/api/admin/players/${playerId}/status`, { method: 'PATCH', body: JSON.stringify({ disabled }) }),
    getAdminItems: ({ page, pageSize, keyword = '' } = {}) => {
      const hasPaging = page !== undefined || pageSize !== undefined || keyword
      if (!hasPaging) return request('/api/admin/items')
      return request(`/api/admin/items?${new URLSearchParams({ page: String(page || 1), pageSize: String(pageSize || 20), keyword })}`)
    },
    createAdminItem: (payload) => request('/api/admin/items', { method: 'POST', body: JSON.stringify(payload) }),
    updateAdminItem: (itemId, payload) => request(`/api/admin/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    updateAdminItemStatus: (itemId, enabled) => request(`/api/admin/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
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
    getAdminNotificationPublications: ({ page, pageSize } = {}) => {
      const hasPaging = page !== undefined || pageSize !== undefined
      return request(hasPaging ? `/api/admin/notifications?${new URLSearchParams({ page: String(page || 1), pageSize: String(pageSize || 20) })}` : '/api/admin/notifications')
    },
    publishAdminNotification: (payload) => request('/api/admin/notifications', { method: 'POST', body: JSON.stringify({ title: payload.title, body: payload.content, recipientIds: payload.audienceType === 'selected' ? payload.recipientIds : null }) }),
    getAdminRechargeProducts: ({ page, pageSize } = {}) => request(page !== undefined || pageSize !== undefined ? `/api/admin/recharge-products?${new URLSearchParams({ page: String(page || 1), pageSize: String(pageSize || 20) })}` : '/api/admin/recharge-products').then((payload) => {
      const products = Array.isArray(payload) ? payload : payload.items
      const mapped = products.map((product) => ({
        id: String(product.id), name: product.displayName, price: Number(product.priceCents) / 100,
        benefitType: product.benefits.benefitType, benefitAmount: product.benefits.benefitAmount,
        benefitName: product.benefits.benefitName || '', description: product.description,
        enabled: product.enabled, sortOrder: product.displayOrder, qrCodeImage: product.qrCodeUrl || '',
      }))
      return Array.isArray(payload) ? mapped : { ...payload, items: mapped }
    }),
    getAdminRechargeOrders: ({ page = 1, pageSize = 20, status = '' } = {}) => request(`/api/admin/recharge-orders?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), status })}`),
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
    openPlayerStateStream(onState, onLeaderboards = () => {}, onAccountDisabled = () => {}, onError = () => {}, onMaintenance = () => {}, onAdminEvent = () => {}) {
      const stream = new EventSource('/api/events')
      stream.addEventListener('player-state', (event) => onState(JSON.parse(event.data)))
      stream.addEventListener('leaderboards', (event) => onLeaderboards(JSON.parse(event.data)))
      stream.addEventListener('account-disabled', onAccountDisabled)
      stream.addEventListener('maintenance-changed', (event) => onMaintenance(JSON.parse(event.data)))
      for (const eventName of ['items-updated', 'players-updated', 'permissions-updated', 'notifications-updated', 'recharge-orders-updated', 'recharge-products-updated']) stream.addEventListener(eventName, (event) => onAdminEvent(eventName, JSON.parse(event.data)))
      stream.addEventListener('error', onError)
      return () => stream.close()
    },
    openAdminEventStream(onEvent = () => {}) {
      const stream = new EventSource('/api/events')
      for (const eventName of ['items-updated', 'players-updated', 'permissions-updated', 'notifications-updated', 'recharge-orders-updated', 'recharge-products-updated']) stream.addEventListener(eventName, (event) => onEvent(eventName, JSON.parse(event.data)))
      return () => stream.close()
    },
  }
}

export const apiClient = createApiClient()
