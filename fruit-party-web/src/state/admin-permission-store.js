import { loadSession, saveSession } from './player-session'

const STORAGE_KEY = 'fruit-party.admin-permissions'
const ADMIN_PASSWORD = 'admin123456'

const DEFAULT_PLAYERS = Object.freeze([
  { id: 1, username: '水果达人', joined: '2026-09-01', coins: 12480, infiniteEnergy: false },
  { id: 2, username: '一刀两半', joined: '2026-09-02', coins: 8620, infiniteEnergy: false },
  { id: 3, username: '蜜瓜骑士', joined: '2026-09-03', coins: 6840, infiniteEnergy: false },
  { id: 4, username: '切切乐', joined: '2026-09-04', coins: 2310, infiniteEnergy: false },
  { id: 5, username: '草莓队长', joined: '2026-09-05', coins: 16730, infiniteEnergy: false },
  { id: 6, username: '菠萝不倒翁', joined: '2026-09-06', coins: 4560, infiniteEnergy: false },
  { id: 7, username: '西瓜巡航', joined: '2026-09-07', coins: 22180, infiniteEnergy: false },
  { id: 8, username: '梨涡浅笑', joined: '2026-09-08', coins: 980, infiniteEnergy: false },
  { id: 9, username: '水果新手', joined: '2026-09-09', coins: 0, infiniteEnergy: false },
])

function defaultState() {
  return {
    players: DEFAULT_PLAYERS.map((player) => ({ ...player })),
    auditLogs: [],
    processedOperations: [],
  }
}

function readState(storage = window.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null')
    return parsed && Array.isArray(parsed.players) ? parsed : defaultState()
  } catch {
    return defaultState()
  }
}

function writeState(state, storage = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
  return state
}

function permissionError(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

function findPlayer(state, userId) {
  const player = state.players.find((entry) => String(entry.id) === String(userId))
  if (!player) throw permissionError('玩家不存在', 'PLAYER_NOT_FOUND')
  return player
}

function syncActivePlayer(player, patch, storage) {
  const session = loadSession(storage)
  if (session.role !== 'admin' && session.username === player.username) saveSession(patch, storage)
}

export async function listPermissionPlayers({ page = 1, pageSize = 6, keyword = '' } = {}, storage = window.localStorage) {
  await Promise.resolve()
  const state = readState(storage)
  const normalizedKeyword = String(keyword).trim().toLowerCase()
  const filtered = state.players.filter((player) => !normalizedKeyword || player.username.toLowerCase().includes(normalizedKeyword))
  const safePageSize = Math.max(1, Number(pageSize) || 6)
  const pageCount = Math.max(1, Math.ceil(filtered.length / safePageSize))
  const safePage = Math.min(Math.max(1, Number(page) || 1), pageCount)
  const start = (safePage - 1) * safePageSize
  return {
    items: filtered.slice(start, start + safePageSize).map((player) => ({ ...player })),
    page: safePage,
    pageSize: safePageSize,
    total: filtered.length,
  }
}

export async function updateInfiniteEnergyPermission(userId, { enabled, adminPassword }, storage = window.localStorage) {
  await Promise.resolve()
  if (adminPassword !== ADMIN_PASSWORD) throw permissionError('管理员密码错误', 'INVALID_ADMIN_PASSWORD')
  const state = readState(storage)
  const player = findPlayer(state, userId)
  player.infiniteEnergy = Boolean(enabled)
  state.auditLogs.unshift({
    id: `permission-${Date.now()}`,
    type: 'admin',
    action: player.infiniteEnergy ? '授予特殊权限' : '撤销特殊权限',
    target: player.username,
    detail: player.infiniteEnergy ? '已授予无限能量' : '已撤销无限能量',
    occurredAt: new Date().toISOString(),
  })
  writeState(state, storage)
  syncActivePlayer(player, { infiniteEnergy: player.infiniteEnergy }, storage)
  return { ...player }
}

export async function grantPlayerCoins(userId, { operationId }, storage = window.localStorage) {
  await Promise.resolve()
  if (!operationId) throw permissionError('缺少操作编号', 'OPERATION_ID_REQUIRED')
  const state = readState(storage)
  const player = findPlayer(state, userId)
  if (state.processedOperations.includes(operationId)) return { ...player, duplicate: true }

  player.coins += 1000
  state.processedOperations.push(operationId)
  state.auditLogs.unshift({
    id: operationId,
    type: 'admin',
    action: '赠送玩家金币',
    target: player.username,
    detail: '管理员赠送 1000 金币',
    occurredAt: new Date().toISOString(),
  })
  writeState(state, storage)
  syncActivePlayer(player, {
    coins: player.coins,
    coinLedger: [
      { amount: 1000, title: '管理员赠送 1000 金币', occurredAt: '刚刚' },
      ...(loadSession(storage).coinLedger || []),
    ].slice(0, 50),
  }, storage)
  return { ...player, duplicate: false }
}

export function getCachedPlayerBenefits(username, storage = window.localStorage) {
  const player = readState(storage).players.find((entry) => entry.username === username)
  return player ? { infiniteEnergy: player.infiniteEnergy, coins: player.coins } : null
}

export function getPermissionAuditLogs(storage = window.localStorage) {
  return readState(storage).auditLogs.map((entry) => ({ ...entry }))
}

export function clearPermissionStore(storage = window.localStorage) {
  storage.removeItem(STORAGE_KEY)
}

export { ADMIN_PASSWORD, STORAGE_KEY }
