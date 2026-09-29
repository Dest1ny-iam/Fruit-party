const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3000'

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  return { status: response.status, body: await response.json() }
}

const username = `live_${Date.now().toString().slice(-10)}`
const registered = await request('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ username, password: 'Player123', acceptedTerms: true }),
})
if (registered.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(registered.body)}`)
const token = registered.body.data.token
const before = await request('/api/me/state', { token })
const settlement = await request('/api/game/settlements', {
  token,
  method: 'POST',
  body: JSON.stringify({
    mode: 'normal', levelNumber: 1, fruitHits: Array.from({ length: 20 }, (_, index) => ({ fruit: 'kiwi', combo: index + 1 })), hitRate: 0.82, elapsedSeconds: 20,
  }),
})
const after = await request('/api/me/state', { token })
if (!settlement.body.data?.passed || after.body.data?.progress.normal.highestUnlockedLevel !== 2) {
  throw new Error(`Settlement did not unlock the next level: ${JSON.stringify({ before, settlement, after })}`)
}
console.log(JSON.stringify({ username, before: before.body.data.progress.normal.highestUnlockedLevel, finalScore: settlement.body.data.finalScore, after: after.body.data.progress.normal.highestUnlockedLevel }))
