import { ENDLESS_UNLOCK_LEVEL } from '../game/progressionRules'

const STORAGE_KEY = 'fruit-party.notifications'

// 后端尚未接入前使用的演示通知。首次进入时写入 localStorage，之后所有操作都持久化，
// 因此刷新页面不会把已读通知重新显示为未读，也不会让删除的通知再次出现。
const DEFAULT_NOTIFICATIONS = Object.freeze([
  { id: 1, type: 'reward', title: '欢迎来到水果切切乐', content: '完成挑战即可获得金币，记得合理使用能量。', time: '今天 09:00', read: false },
  { id: 2, type: 'system', title: '无尽模式规则更新', content: `普通模式完成第 ${ENDLESS_UNLOCK_LEVEL} 关后即可开启无尽挑战。`, time: '昨天 18:30', read: false },
  { id: 3, type: 'notice', title: '商店道具上新', content: '新的切水果道具已经加入商店。', time: '2026-09-18 12:10', read: true },
])

function cloneDefaults() {
  return DEFAULT_NOTIFICATIONS.map((item) => ({ ...item }))
}

function saveDemoNotifications(notifications, storage = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(notifications))
  return notifications
}

export function loadDemoNotifications(storage = window.localStorage) {
  try {
    const saved = storage.getItem(STORAGE_KEY)
    if (saved === null) return saveDemoNotifications(cloneDefaults(), storage)
    const notifications = JSON.parse(saved)
    return Array.isArray(notifications) ? notifications : cloneDefaults()
  } catch {
    return cloneDefaults()
  }
}

export function markDemoNotificationRead(notificationId, storage = window.localStorage) {
  return saveDemoNotifications(
    loadDemoNotifications(storage).map((item) => (
      item.id === notificationId ? { ...item, read: true } : item
    )),
    storage,
  )
}

export function markAllDemoNotificationsRead(storage = window.localStorage) {
  return saveDemoNotifications(
    loadDemoNotifications(storage).map((item) => ({ ...item, read: true })),
    storage,
  )
}

export function deleteDemoNotification(notificationId, storage = window.localStorage) {
  return saveDemoNotifications(
    loadDemoNotifications(storage).filter((item) => item.id !== notificationId),
    storage,
  )
}

export function deleteReadDemoNotifications(storage = window.localStorage) {
  return saveDemoNotifications(
    loadDemoNotifications(storage).filter((item) => !item.read),
    storage,
  )
}

export { STORAGE_KEY as NOTIFICATION_STORAGE_KEY }
