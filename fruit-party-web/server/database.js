import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { levelTarget } from './scoring.js'

const schema = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8')
const LEVELS = Array.from({ length: 10 }, (_, index) => index + 1)

export function createDatabase(databasePath = 'fruit-party.db') {
  const db = new Database(databasePath)
  db.pragma('journal_mode = WAL')
  db.exec(schema)
  return db
}

export function seedDatabase(db, hashPassword) {
  const seedUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password_hash, role, is_tester, coins)
    VALUES (@username, @passwordHash, @role, @isTester, @coins)
  `)
  const testerPassword = hashPassword('Tester123')
  const adminPassword = hashPassword('Admin123')
  seedUser.run({ username: 'tester', passwordHash: testerPassword, role: 'player', isTester: 1, coins: 1000 })
  seedUser.run({ username: 'admin', passwordHash: adminPassword, role: 'admin', isTester: 0, coins: 0 })
  seedUser.run({ username: '水果达人', passwordHash: hashPassword('Player123'), role: 'player', isTester: 0, coins: 580 })
  seedUser.run({ username: '一刀两半', passwordHash: hashPassword('Player123'), role: 'player', isTester: 0, coins: 420 })

  const users = db.prepare('SELECT id, username, is_tester FROM users').all()
  const insertProgress = db.prepare(`
    INSERT OR IGNORE INTO level_progress (user_id, mode, level_number, unlocked, best_score)
    VALUES (?, ?, ?, ?, ?)
  `)
  for (const user of users) {
    for (const mode of ['normal', 'hard']) {
      for (const level of LEVELS) {
        const unlocked = user.is_tester || level === 1 ? 1 : 0
        insertProgress.run(user.id, mode, level, unlocked, 0)
      }
    }
  }

  // 开发环境的展示记录同样走正式表结构；前端不会拥有任何排行榜假数据。
  const userIds = Object.fromEntries(users.map((user) => [user.username, user.id]))
  const addAttempt = db.prepare(`
      INSERT INTO game_attempts (user_id, mode, level_number, base_score, final_score, hit_rate, elapsed_seconds, passed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const hasEndlessAttempt = db.prepare('SELECT 1 FROM game_attempts WHERE user_id = ? AND mode = ? LIMIT 1')
  const addSeededEndlessAttempt = (username, baseScore, finalScore, hitRate, elapsedSeconds) => {
    if (!hasEndlessAttempt.get(userIds[username], 'endless')) {
      addAttempt.run(userIds[username], 'endless', null, baseScore, finalScore, hitRate, elapsedSeconds, 0)
    }
  }
  addSeededEndlessAttempt('水果达人', 73200, 98420, 0.82, 146)
  addSeededEndlessAttempt('一刀两半', 66100, 86100, 0.79, 163)
  addSeededEndlessAttempt('tester', 51300, 65600, 0.74, 188)

  const completeHardLevel = db.prepare(`
      UPDATE level_progress SET best_score = ?, completed_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND mode = 'hard' AND level_number = ? AND completed_at IS NULL
    `)
  for (let level = 1; level <= 5; level += 1) completeHardLevel.run(500 + level * 170, userIds['水果达人'], level)
  for (let level = 1; level <= 4; level += 1) completeHardLevel.run(460 + level * 150, userIds['一刀两半'], level)
}

export function readPlayerState(db, userId) {
  const player = db.prepare(`
    SELECT id, username, role, is_tester AS isTester, avatar_url AS avatarUrl,
           coins, energy, max_energy AS maxEnergy, energy_recovery_started_at AS energyRecoveryStartedAt,
           created_at AS createdAt
    FROM users WHERE id = ?
  `).get(userId)
  if (!player) return null

  const progress = db.prepare(`
    SELECT mode, level_number AS levelNumber, unlocked, best_score AS bestScore, completed_at AS completedAt
    FROM level_progress WHERE user_id = ? ORDER BY mode, level_number
  `).all(userId)
  const modes = ['normal', 'hard'].reduce((result, mode) => {
    const rows = progress.filter((entry) => entry.mode === mode)
    const unlocked = rows.filter((entry) => entry.unlocked).map((entry) => entry.levelNumber)
    result[mode] = {
      highestUnlockedLevel: unlocked.length ? Math.max(...unlocked) : 0,
      levels: rows.map((entry) => ({ ...entry, unlocked: Boolean(entry.unlocked), targetScore: levelTarget(mode, entry.levelNumber) })),
    }
    return result
  }, {})

  return {
    player: {
      id: player.id,
      username: player.username,
      role: player.role,
      isTester: Boolean(player.isTester),
      avatarUrl: player.avatarUrl,
      createdAt: player.createdAt,
    },
    wallet: {
      coins: player.coins,
      energy: player.energy,
      maxEnergy: player.maxEnergy,
      energyRecoveryStartedAt: player.energyRecoveryStartedAt,
    },
    progress: modes,
  }
}

export function readLeaderboards(db) {
  const endless = db.prepare(`
    SELECT u.username AS name, MAX(a.final_score) AS score
    FROM game_attempts a JOIN users u ON u.id = a.user_id
    WHERE a.mode = 'endless'
    GROUP BY u.id, u.username ORDER BY score DESC, MIN(a.created_at) ASC LIMIT 50
  `).all().map((entry, index) => ({ rank: index + 1, avatar: entry.name.slice(0, 1), name: entry.name, score: entry.score }))
  const hard = db.prepare(`
    SELECT u.username AS name, COUNT(*) AS completedLevels
    FROM level_progress p JOIN users u ON u.id = p.user_id
    WHERE p.mode = 'hard' AND p.completed_at IS NOT NULL
    GROUP BY u.id, u.username ORDER BY completedLevels DESC, u.id ASC LIMIT 50
  `).all().map((entry, index) => ({ rank: index + 1, avatar: entry.name.slice(0, 1), name: entry.name, score: `通关 ${entry.completedLevels} 关` }))
  return { endless, hard }
}
