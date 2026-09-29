const STORAGE_KEY = 'fruit-party.admin-notification-publications'

const DEFAULT_PUBLICATIONS = Object.freeze([
  Object.freeze({
    id: 'notice-maintenance-finished',
    type: 'system',
    title: '维护完成通知',
    content: '服务器维护已经完成，游戏服务现已恢复。',
    audienceType: 'all',
    audienceLabel: '全体玩家',
    recipientIds: [],
    recipientNames: [],
    recipientCount: 12846,
    readCount: 8640,
    sentAt: '今天 09:00',
    status: 'sent',
  }),
])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export async function listDemoNotificationPublications(storage = window.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || 'null')
    return clone(Array.isArray(saved) ? saved : DEFAULT_PUBLICATIONS)
  } catch {
    return clone(DEFAULT_PUBLICATIONS)
  }
}

export async function publishDemoNotification(payload, storage = window.localStorage) {
  const recipientIds = payload.audienceType === 'selected' ? [...(payload.recipientIds || [])] : []
  const recipientNames = payload.audienceType === 'selected' ? [...(payload.recipientNames || [])] : []
  const publication = {
    id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: payload.type || 'notice',
    title: String(payload.title || '').trim(),
    content: String(payload.content || '').trim(),
    audienceType: payload.audienceType === 'selected' ? 'selected' : 'all',
    audienceLabel: payload.audienceType === 'selected' ? `指定玩家（${recipientIds.length}）` : '全体玩家',
    recipientIds,
    recipientNames,
    recipientCount: payload.audienceType === 'selected' ? recipientIds.length : 12846,
    readCount: 0,
    sentAt: '刚刚',
    status: 'sent',
  }
  if (!publication.title) throw new Error('请输入通知标题')
  if (!publication.content) throw new Error('请输入通知内容')
  if (publication.audienceType === 'selected' && publication.recipientIds.length === 0) throw new Error('请至少选择一名玩家')

  const publications = await listDemoNotificationPublications(storage)
  storage.setItem(STORAGE_KEY, JSON.stringify([publication, ...publications]))
  return clone(publication)
}

export { STORAGE_KEY as ADMIN_NOTIFICATION_STORAGE_KEY }
