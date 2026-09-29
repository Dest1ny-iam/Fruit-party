import { EMPTY_INVENTORY } from '../data/item-data'

const STORAGE_KEY = 'fruit-party.player-session'

export const DEFAULT_SESSION = Object.freeze({
  authenticated: false,
  role: 'player',
  internalTestModeEnabled: false,
  infiniteEnergy: false,
  token: null,
  username: '水果新手',
  avatar: '🍉',
  highestLevel: 1,
  // 已解锁关卡和已通关关卡必须分开；无尽模式只读取已通关进度。
  highestCompletedLevel: 0,
  // 困难模式的解锁顺序独立于普通模式，避免两个模式互相影响进度。
  highestHardLevel: 1,
  highestCompletedHardLevel: 0,
  energy: 5,
  energyRecoverAt: null,
  coins: 0,
  inventory: EMPTY_INVENTORY,
  coinBoostUntil: null,
  coinLedger: [],
  // 键为关卡号；有键即代表该关已经实际挑战过，即使最终得分为 0。
  bestScores: { normal: {}, hard: {}, endless: null },
})

export function loadSession(storage = window.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || 'null')
    const stored = saved || {}
    const session = { ...DEFAULT_SESSION, ...stored }
    // 旧版本只保存“最高已解锁关卡”。迁移时保守地视为前一关已完成，
    // 防止仅仅解锁第五关的玩家被误判为已经通关第五关。
    if (!Object.prototype.hasOwnProperty.call(stored, 'highestCompletedLevel')) {
      session.highestCompletedLevel = Math.max(0, (Number(session.highestLevel) || 1) - 1)
    }
    if (!Object.prototype.hasOwnProperty.call(stored, 'highestCompletedHardLevel')) {
      session.highestCompletedHardLevel = Math.max(0, (Number(session.highestHardLevel) || 1) - 1)
    }
    return session
  } catch {
    return { ...DEFAULT_SESSION }
  }
}

export function saveSession(patch, storage = window.localStorage) {
  const session = { ...loadSession(storage), ...patch }
  storage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

export function clearSession(storage = window.localStorage) {
  storage.removeItem(STORAGE_KEY)
}

// 所有金币增减都经由这一个入口记录，后端接入时可直接替换为账本表写入。
export function appendCoinLedger(entry, storage = window.localStorage) {
  const session = loadSession(storage)
  const record = {
    amount: Number(entry.amount) || 0,
    title: entry.title || '金币变动',
    occurredAt: entry.occurredAt || '刚刚',
  }
  return saveSession({ coinLedger: [record, ...(session.coinLedger || [])].slice(0, 50) }, storage)
}

export function hasSession(storage = window.localStorage) {
  return loadSession(storage).authenticated === true
}

export function hasAdminSession(storage = window.localStorage) {
  const session = loadSession(storage)
  return session.authenticated === true && session.role === 'admin'
}

export { STORAGE_KEY }
