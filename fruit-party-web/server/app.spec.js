import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'

const instances = []

function makeClient() {
  const instance = createApp({ databasePath: ':memory:', seed: true })
  instances.push(instance)
  return request(instance.app)
}

afterEach(() => {
  while (instances.length) instances.pop().close()
})

describe('player API', () => {
  it('exposes health without authentication', async () => {
    const response = await makeClient().get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('ok')
  })

  it('seeds test and administrator accounts', async () => {
    const client = makeClient()
    const tester = await client.post('/api/auth/login').send({ username: 'tester', password: 'Tester123', acceptedTerms: true })
    const admin = await client.post('/api/auth/login').send({ username: 'admin', password: 'Admin123', acceptedTerms: true })

    expect(tester.status).toBe(200)
    expect(tester.body.data.player.username).toBe('tester')
    expect(admin.status).toBe(200)
    expect(admin.body.data.player.role).toBe('admin')
  })

  it('requires agreement acceptance before login', async () => {
    const response = await makeClient().post('/api/auth/login').send({ username: 'tester', password: 'Tester123', acceptedTerms: false })

    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe('TERMS_REQUIRED')
  })

  it('rejects player state access without a token', async () => {
    const response = await makeClient().get('/api/me/state')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('AUTH_REQUIRED')
  })

  it('rejects an already named account with a displayable conflict code', async () => {
    const response = await makeClient().post('/api/auth/register').send({
      username: 'tester', password: 'Player123', acceptedTerms: true,
    })

    expect(response.status).toBe(409)
    expect(response.body.error).toEqual({ code: 'USERNAME_TAKEN', message: '用户名已被注册，请重新取名' })
  })

  it('returns persisted player state after login', async () => {
    const client = makeClient()
    const login = await client.post('/api/auth/login').send({ username: 'tester', password: 'Tester123', acceptedTerms: true })
    const response = await client.get('/api/me/state').set('Authorization', `Bearer ${login.body.data.token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.player.username).toBe('tester')
    expect(response.body.data.progress.normal.highestUnlockedLevel).toBe(10)
    expect(response.body.data.wallet.coins).toBeGreaterThan(0)
  })

  it('returns leaderboard entries generated from seeded database attempts', async () => {
    const response = await makeClient().get('/api/leaderboards')

    expect(response.status).toBe(200)
    expect(response.body.data.endless[0]).toMatchObject({ name: '水果达人', score: expect.any(Number) })
    expect(response.body.data.hard[0]).toMatchObject({ name: '水果达人', score: '通关 5 关' })
  })

  it('settles a passed level on the server and unlocks only the next level', async () => {
    const client = makeClient()
    const login = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const token = login.body.data.token
    const settlement = await client.post('/api/game/settlements').set('Authorization', `Bearer ${token}`).send({
      mode: 'normal',
      levelNumber: 1,
      fruitHits: Array(3).fill({ fruit: 'watermelon' }),
      hitRate: 0.82,
      elapsedSeconds: 25,
      clientFinalScore: 999999,
    })
    const state = await client.get('/api/me/state').set('Authorization', `Bearer ${token}`)

    expect(settlement.status).toBe(201)
    expect(settlement.body.data.finalScore).toBeLessThan(999999)
    expect(settlement.body.data.passed).toBe(true)
    expect(state.body.data.progress.normal.highestUnlockedLevel).toBe(2)
  })

  it('does not let a standard player settle a locked level directly', async () => {
    const client = makeClient()
    const login = await client.post('/api/auth/login').send({ username: '水果达人', password: 'Player123', acceptedTerms: true })
    const response = await client.post('/api/game/settlements').set('Authorization', `Bearer ${login.body.data.token}`).send({
      mode: 'normal', levelNumber: 2, fruitHits: Array(10).fill({ fruit: 'watermelon' }), hitRate: 0.82, elapsedSeconds: 20,
    })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('LEVEL_LOCKED')
  })
})
