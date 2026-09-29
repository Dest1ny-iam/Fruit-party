import { loadSession } from '../state/player-session'

const DEFAULT_TIMEOUT = 8000

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export async function request(path, options = {}, dependencies = {}) {
  const fetcher = dependencies.fetcher || window.fetch.bind(window)
  const baseUrl = dependencies.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api'
  const timeout = dependencies.timeout ?? DEFAULT_TIMEOUT
  const token = dependencies.token ?? loadSession().token
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetcher(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new ApiError(payload?.message || `请求失败（${response.status}）`, response.status, payload)
    return payload
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError('请求超时，请稍后重试')
    if (error instanceof ApiError) throw error
    throw new ApiError('网络连接失败，请检查服务是否启动', 0, error)
  } finally {
    window.clearTimeout(timer)
  }
}
