import { describe, expect, it, vi } from 'vitest'
import { ApiError, request } from './http'

describe('API 请求层', () => {
  it('统一补充 JSON 头并解析响应', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    await expect(request('/health', { method: 'GET' }, { fetcher, baseUrl: '/api' })).resolves.toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledWith('/api/health', expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }))
  })

  it('把后端错误统一成 ApiError', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: '登录已过期' }) })

    await expect(request('/me', {}, { fetcher })).rejects.toMatchObject({ name: 'ApiError', status: 401, message: '登录已过期' })
  })
})
