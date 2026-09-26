const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3000'

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  return { status: response.status, body: await response.json() }
}

async function register(prefix) {
  const username = `${prefix}${Date.now().toString().slice(-10)}`
  const response = await api('/api/auth/register', {
    method: 'POST', body: JSON.stringify({ username, password: 'Player123', acceptedTerms: true }),
  })
  if (response.status !== 201) throw new Error(`Register ${username}: ${JSON.stringify(response.body)}`)
  return { username, token: response.body.data.token }
}

async function settleFirstLevel(token) {
  return api('/api/game/settlements', {
    token,
    method: 'POST',
    body: JSON.stringify({ mode: 'normal', levelNumber: 1, fruitHits: Array(3).fill({ fruit: 'watermelon' }), hitRate: 0.82, elapsedSeconds: 20 }),
  })
}

async function readNextLeaderboardEvent(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffered = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) throw new Error('SSE closed before leaderboard event')
    buffered += decoder.decode(value, { stream: true })
    const eventEnd = buffered.indexOf('\n\n')
    if (eventEnd === -1) continue
    const event = buffered.slice(0, eventEnd)
    buffered = buffered.slice(eventEnd + 2)
    if (event.startsWith('event: leaderboards\n')) return event
  }
}

const [first, second] = await Promise.all([register('qaA'), register('qaB')])
const before = await Promise.all([api('/api/me/state', { token: first.token }), api('/api/me/state', { token: second.token })])
if (before.some((state) => state.body.data.progress.normal.highestUnlockedLevel !== 1)) throw new Error('New accounts did not start at level 1')

const controller = new AbortController()
const stream = await fetch(`${baseUrl}/api/events`, { headers: { authorization: `Bearer ${first.token}` }, signal: controller.signal })
const leaderboardEvent = readNextLeaderboardEvent(stream)
const settlements = await Promise.all([settleFirstLevel(first.token), settleFirstLevel(second.token)])
if (settlements.some((result) => result.status !== 201 || !result.body.data.passed)) throw new Error('Parallel settlement failed')
await Promise.race([leaderboardEvent, new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for leaderboard SSE')), 3000))])
controller.abort()

const after = await Promise.all([api('/api/me/state', { token: first.token }), api('/api/me/state', { token: second.token })])
if (after.some((state) => state.body.data.progress.normal.highestUnlockedLevel !== 2)) throw new Error('Parallel settlement did not unlock level 2 independently')

const adminLogin = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'Admin123', acceptedTerms: true }) })
const candidates = await api('/api/admin/players', { token: adminLogin.body.data.token })
const firstCandidate = candidates.body.data.find((player) => player.username === first.username)
await api(`/api/admin/players/${firstCandidate.id}/status`, { token: adminLogin.body.data.token, method: 'PATCH', body: JSON.stringify({ disabled: true }) })
const disabledSession = await api('/api/me/state', { token: first.token })
const refreshedCandidates = await api('/api/admin/players', { token: adminLogin.body.data.token })
if (disabledSession.status !== 403 || refreshedCandidates.body.data.some((player) => player.username === first.username)) {
  throw new Error('Disabled account remained active')
}

console.log(JSON.stringify({ first: first.username, second: second.username, unlockedLevel: 2, sse: 'leaderboards', disabledAccountRejected: true }))
