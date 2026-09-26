export class ApiError extends Error {
  constructor({ code = 'REQUEST_FAILED', message = '请求失败', status = 0 }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function createApiClient({ fetcher = window.fetch.bind(window), getToken = () => localStorage.getItem('fruit-party-token') } = {}) {
  async function request(path, options = {}) {
    const token = getToken()
    const response = await fetcher(path, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    const payload = await response.json()
    if (!response.ok) throw new ApiError({ ...payload.error, status: response.status })
    return payload.data
  }

  return {
    login: (credentials) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (credentials) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(credentials) }),
    getPlayerState: () => request('/api/me/state'),
    getLeaderboards: () => request('/api/leaderboards'),
    settleGame: (settlement) => request('/api/game/settlements', { method: 'POST', body: JSON.stringify(settlement) }),
    openPlayerStateStream(onState, onError = () => {}) {
      const stream = new EventSource('/api/events')
      stream.addEventListener('player-state', (event) => onState(JSON.parse(event.data)))
      stream.addEventListener('error', onError)
      return () => stream.close()
    },
  }
}

export const apiClient = createApiClient()
