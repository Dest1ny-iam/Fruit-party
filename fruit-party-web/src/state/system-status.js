const STORAGE_KEY = 'fruit-party.system-status'

export const DEFAULT_SYSTEM_STATUS = Object.freeze({
  maintenanceEnabled: false,
  message: '游戏正在维护中，请稍后再试。',
})

// 维护状态在前端演示阶段保存在浏览器；上线后由公开配置接口覆盖这份本地缓存。
export function loadSystemStatus(storage = window.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || 'null')
    return { ...DEFAULT_SYSTEM_STATUS, ...(saved || {}) }
  } catch {
    return { ...DEFAULT_SYSTEM_STATUS }
  }
}

export function saveSystemStatus(patch, storage = window.localStorage) {
  const status = { ...loadSystemStatus(storage), ...patch }
  storage.setItem(STORAGE_KEY, JSON.stringify(status))
  return status
}

export function clearSystemStatus(storage = window.localStorage) {
  storage.removeItem(STORAGE_KEY)
}

export function isMaintenanceEnabled(storage = window.localStorage) {
  return loadSystemStatus(storage).maintenanceEnabled === true
}
