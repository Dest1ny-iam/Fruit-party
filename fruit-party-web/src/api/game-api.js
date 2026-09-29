import { request } from './http'

export const gameApi = {
  login(credentials, requester = request) { return requester('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }) },
  register(credentials, requester = request) { return requester('/auth/register', { method: 'POST', body: JSON.stringify(credentials) }) },
  getPlayerSummary(requester = request) { return requester('/player/summary') },
  getLevels(mode = 'normal', page = 1, pageSize = 10, requester = request) {
    return requester(`/levels?mode=${encodeURIComponent(mode)}&page=${page}&pageSize=${pageSize}`)
  },
  // 开局和结算使用 games 资源，后端可以用 gameId 做幂等校验和事务关联。
  startRound(payload, requester = request) { return requester('/games/start', { method: 'POST', body: JSON.stringify(payload) }) },
  submitRound(gameId, result, requester = request) {
    return requester(`/games/${encodeURIComponent(gameId)}/settlement`, { method: 'POST', body: JSON.stringify(result) })
  },
  getLeaderboard(mode = 'endless', page = 1, pageSize = 10, requester = request) {
    return requester(`/leaderboard?mode=${encodeURIComponent(mode)}&page=${page}&pageSize=${pageSize}`)
  },
  getShop(requester = request) { return requester('/shop/items') },
  buyItem(itemId, quantity = 1, requester = request) {
    return requester(`/shop/items/${encodeURIComponent(itemId)}/buy`, {
      method: 'POST',
      body: JSON.stringify({ quantity }),
    })
  },
  getInventory(requester = request) { return requester('/inventory') },
  useInventoryItem(itemId, requester = request) { return requester(`/inventory/${encodeURIComponent(itemId)}/use`, { method: 'POST' }) },
  sellInventoryItem(itemId, requester = request) { return requester(`/inventory/${encodeURIComponent(itemId)}/sell`, { method: 'POST' }) },
  getNotifications(page = 1, pageSize = 10, requester = request) {
    return requester(`/notifications?page=${page}&pageSize=${pageSize}`)
  },
  markNotificationRead(notificationId, requester = request) {
    return requester(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' })
  },
  markAllNotificationsRead(requester = request) {
    return requester('/notifications/read-all', { method: 'POST' })
  },
  // 删除的是当前玩家与通知的关系。后端应写 deleted_at 软删除标记，
  // 避免全局通知在下一次查询时重新变成该玩家的未读通知。
  deleteNotification(notificationId, requester = request) {
    return requester(`/notifications/${encodeURIComponent(notificationId)}`, { method: 'DELETE' })
  },
  deleteReadNotifications(requester = request) {
    return requester('/notifications/read', { method: 'DELETE' })
  },
  getRechargeProducts(requester = request) {
    return requester('/recharge/products')
  },
  createRechargeOrder(productId, requester = request) {
    return requester('/recharge/orders', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    })
  },
  getRechargeOrder(orderId, requester = request) {
    return requester(`/recharge/orders/${encodeURIComponent(orderId)}`)
  },
}
