import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './api.js'

describe('API client', () => {
  it('sends the stored bearer token and unwraps server data', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { player: { username: 'tester' } }, error: null }),
    })
    const client = createApiClient({ fetcher, getToken: () => 'signed-token' })

    await expect(client.getPlayerState()).resolves.toEqual({ player: { username: 'tester' } })
    expect(fetcher).toHaveBeenCalledWith('/api/me/state', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer signed-token' }),
    }))
  })

  it('exposes server validation messages instead of replacing them with fixture state', async () => {
    const client = createApiClient({
      fetcher: async () => ({ ok: false, json: async () => ({ data: null, error: { code: 'USERNAME_TAKEN', message: '用户名已被注册，请重新取名' } }) }),
      getToken: () => null,
    })

    await expect(client.register({ username: '水果达人', password: 'Player123', acceptedTerms: true }))
      .rejects.toMatchObject({ code: 'USERNAME_TAKEN', message: '用户名已被注册，请重新取名' })
  })
})
