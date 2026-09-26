import cors from 'cors'
import express from 'express'
import { createDatabase, readLeaderboards, readPlayerState, seedDatabase } from './database.js'
import { hashPassword, issueToken, readToken, validateCredentials, verifyPassword } from './auth.js'
import { calculateSettlement } from './scoring.js'
import { createRealtimeHub } from './realtime.js'

const JWT_SECRET = process.env.JWT_SECRET || 'fruit-party-local-development-secret'
const SESSION_COOKIE = 'fruit_party_session'

function apiError(res, status, code, message) {
  return res.status(status).json({ data: null, error: { code, message } })
}

function sessionToken(req) {
  const bearerToken = req.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (bearerToken) return bearerToken
  return req.get('Cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1)
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  })
}

export function createApp({ databasePath, seed = false } = {}) {
  const db = createDatabase(databasePath)
  if (seed) seedDatabase(db, hashPassword)
  const realtime = createRealtimeHub()
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  const authenticate = (req, res, next) => {
    const token = sessionToken(req)
    if (!token) return apiError(res, 401, 'AUTH_REQUIRED', '请先登录')
    try {
      req.auth = readToken(token, JWT_SECRET)
      return next()
    } catch {
      return apiError(res, 401, 'INVALID_TOKEN', '登录状态已失效')
    }
  }

  app.get('/api/health', async (_req, res) => res.json({ data: { status: 'ok' }, error: null }))

  app.post('/api/auth/login', async (req, res) => {
    const { username = '', password = '', acceptedTerms = false } = req.body || {}
    if (!acceptedTerms) return apiError(res, 422, 'TERMS_REQUIRED', '请先阅读并同意用户协议')
    const user = db.prepare('SELECT id, username, password_hash AS passwordHash, role FROM users WHERE username = ?').get(username.trim())
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return apiError(res, 401, 'INVALID_CREDENTIALS', '用户名或密码错误')
    }
    const token = issueToken(user, JWT_SECRET)
    setSessionCookie(res, token)
    return res.json({ data: { token, player: { id: user.id, username: user.username, role: user.role } }, error: null })
  })

  app.post('/api/auth/register', async (req, res) => {
    const { username = '', password = '', acceptedTerms = false } = req.body || {}
    const error = validateCredentials({ username: username.trim(), password })
    if (error) return apiError(res, 422, 'INVALID_CREDENTIALS', error)
    if (!acceptedTerms) return apiError(res, 422, 'TERMS_REQUIRED', '请先阅读并同意用户协议')
    try {
      const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username.trim(), hashPassword(password))
      const userId = Number(result.lastInsertRowid)
      const insertProgress = db.prepare('INSERT INTO level_progress (user_id, mode, level_number, unlocked) VALUES (?, ?, ?, ?)')
      for (const mode of ['normal', 'hard']) for (let level = 1; level <= 10; level += 1) insertProgress.run(userId, mode, level, level === 1 ? 1 : 0)
      const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId)
      const token = issueToken(user, JWT_SECRET)
      setSessionCookie(res, token)
      return res.status(201).json({ data: { token, player: user }, error: null })
    } catch (caught) {
      if (String(caught.message).includes('UNIQUE')) return apiError(res, 409, 'USERNAME_TAKEN', '用户名已被注册，请重新取名')
      throw caught
    }
  })

  app.get('/api/me/state', authenticate, async (req, res) => {
    const state = readPlayerState(db, req.auth.sub)
    if (!state) return apiError(res, 404, 'PLAYER_NOT_FOUND', '玩家不存在')
    return res.json({ data: state, error: null })
  })

  app.get('/api/leaderboards', async (_req, res) => {
    return res.json({ data: readLeaderboards(db), error: null })
  })

  app.get('/api/events', authenticate, async (req, res) => {
    res.status(200).set({
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
    })
    res.flushHeaders()
    res.write(`event: player-state\ndata: ${JSON.stringify(readPlayerState(db, req.auth.sub))}\n\n`)
    const unsubscribe = realtime.subscribe(req.auth.sub, res)
    req.on('close', unsubscribe)
  })

  app.post('/api/game/settlements', authenticate, async (req, res) => {
    const { mode, levelNumber, fruitHits, hitRate, elapsedSeconds } = req.body || {}
    if (!['normal', 'hard', 'endless'].includes(mode)) return apiError(res, 422, 'INVALID_MODE', '无效的游戏模式')
    if (mode !== 'endless' && (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > 10)) {
      return apiError(res, 422, 'INVALID_LEVEL', '无效的关卡')
    }

    const player = db.prepare('SELECT is_tester AS isTester FROM users WHERE id = ?').get(req.auth.sub)
    if (!player) return apiError(res, 404, 'PLAYER_NOT_FOUND', '玩家不存在')
    if (mode !== 'endless') {
      const progress = db.prepare('SELECT unlocked FROM level_progress WHERE user_id = ? AND mode = ? AND level_number = ?')
        .get(req.auth.sub, mode, levelNumber)
      if (!player.isTester && !progress?.unlocked) return apiError(res, 403, 'LEVEL_LOCKED', '该关卡尚未解锁')
    }

    let settlement
    try {
      settlement = calculateSettlement({ mode, levelNumber, fruitHits, hitRate, elapsedSeconds })
    } catch {
      return apiError(res, 422, 'INVALID_SETTLEMENT', '无法计算本局结算')
    }

    const persist = db.transaction(() => {
      db.prepare(`
        INSERT INTO game_attempts (user_id, mode, level_number, base_score, final_score, hit_rate, elapsed_seconds, passed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.auth.sub, mode, mode === 'endless' ? null : levelNumber, settlement.baseScore, settlement.finalScore,
        settlement.hitRate, settlement.elapsedSeconds, settlement.passed ? 1 : 0)

      if (mode !== 'endless') {
        db.prepare(`
          UPDATE level_progress
          SET best_score = MAX(best_score, ?), completed_at = CASE WHEN ? THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END
          WHERE user_id = ? AND mode = ? AND level_number = ?
        `).run(settlement.finalScore, settlement.passed ? 1 : 0, req.auth.sub, mode, levelNumber)
        if (settlement.passed && levelNumber < 10) {
          db.prepare('UPDATE level_progress SET unlocked = 1 WHERE user_id = ? AND mode = ? AND level_number = ?')
            .run(req.auth.sub, mode, levelNumber + 1)
        }
      }
    })
    persist()
    realtime.publish(req.auth.sub, 'player-state', readPlayerState(db, req.auth.sub))
    return res.status(201).json({ data: settlement, error: null })
  })

  app.use((error, _req, res, _next) => {
    console.error(error)
    apiError(res, 500, 'INTERNAL_ERROR', '服务器内部错误')
  })

  return { app, db, close: () => { realtime.close(); db.close() } }
}
