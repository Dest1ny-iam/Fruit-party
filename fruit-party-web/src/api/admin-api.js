import { request } from './http'

// 管理员 API 与玩家 API 分开，便于后端按 ADMIN 权限统一拦截，也避免普通页面误调用后台资源。
function query(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

export const adminApi = {
  login(credentials, requester = request) {
    return requester('/admin/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
  },
  getOverview(requester = request) {
    return requester('/admin/overview')
  },
  getUsers({ page = 1, pageSize = 20, keyword = '' } = {}, requester = request) {
    return requester(`/admin/users?${query({ page, pageSize, keyword })}`)
  },
  updateUserStatus(userId, enabled, requester = request) {
    return requester(`/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    })
  },
  getItems(requester = request) {
    return requester('/admin/items')
  },
  updateItemPrice(itemId, price, requester = request) {
    return requester(`/admin/items/${encodeURIComponent(itemId)}/price`, {
      method: 'PATCH',
      body: JSON.stringify({ price }),
    })
  },
  getLogs({ page = 1, pageSize = 20, type = 'all' } = {}, requester = request) {
    return requester(`/admin/logs?${query({ page, pageSize, type: type === 'all' ? '' : type })}`)
  },
  getRevenue(range = '6m', requester = request) {
    return requester(`/admin/revenue?${query({ range })}`)
  },
  getPlayerGames(userId, { page = 1, pageSize = 20 } = {}, requester = request) {
    return requester(`/admin/users/${encodeURIComponent(userId)}/games?${query({ page, pageSize })}`)
  },
  // 审计日志覆盖对局、账户账务和道具使用；接口返回 { items, page, pageSize, total }。
  getPlayerAuditLogs(userId, { page = 1, pageSize = 20, type = 'all' } = {}, requester = request) {
    return requester(`/admin/users/${encodeURIComponent(userId)}/audit-logs?${query({ page, pageSize, type: type === 'all' ? '' : type })}`)
  },
  getFeedback({ page = 1, pageSize = 20, status = '' } = {}, requester = request) {
    return requester(`/admin/feedback?${query({ page, pageSize, status })}`)
  },
  updateFeedbackStatus(feedbackId, status, requester = request) {
    return requester(`/admin/feedback/${encodeURIComponent(feedbackId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  getMaintenance(requester = request) {
    return requester('/admin/system/maintenance')
  },
  updateMaintenance(enabled, message, requester = request) {
    return requester('/admin/system/maintenance', {
      method: 'PATCH',
      body: JSON.stringify({ enabled, message }),
    })
  },
  getRechargeProducts(requester = request) {
    return requester('/admin/recharge/products')
  },
  createRechargeProduct(payload, requester = request) {
    return requester('/admin/recharge/products', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateRechargeProduct(productId, payload, requester = request) {
    return requester(`/admin/recharge/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH', body: JSON.stringify(payload),
    })
  },
  uploadRechargeQrCode(productId, file, requester = request) {
    const body = new FormData()
    body.append('file', file)
    return requester(`/admin/recharge/products/${encodeURIComponent(productId)}/qr-code`, { method: 'POST', body })
  },
  getPlayerPermissions({ page = 1, pageSize = 6, keyword = '' } = {}, requester = request) {
    return requester(`/admin/permissions?${query({ page, pageSize, keyword })}`)
  },
  updateInfiniteEnergy(userId, enabled, adminPassword, requester = request) {
    return requester(`/admin/users/${encodeURIComponent(userId)}/permissions/infinite-energy`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled, adminPassword }),
    })
  },
  grantPlayerCoins(userId, operationId, requester = request) {
    return requester(`/admin/users/${encodeURIComponent(userId)}/coin-grants`, {
      method: 'POST',
      headers: { 'Idempotency-Key': operationId },
      body: JSON.stringify({ amount: 1000 }),
    })
  },
  getNotificationPublications({ page = 1, pageSize = 20 } = {}, requester = request) {
    return requester(`/admin/notifications/publications?${query({ page, pageSize })}`)
  },
  publishNotification(payload, requester = request) {
    return requester('/admin/notifications/publications', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
