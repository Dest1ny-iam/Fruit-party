import 'dotenv/config'
import mysql from 'mysql2/promise'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { levelTarget } from './scoring.js'

const schema = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.mysql.sql'), 'utf8')
const LEVELS = Array.from({ length: 10 }, (_, index) => index + 1)
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_]+$/
const ENERGY_RECOVERY_INTERVAL_MS = 10 * 60 * 1000

export const CATALOG_ITEMS = Object.freeze([
  ['revive-card', '复活卡', '失败后继续当前挑战。', 600, 99],
  ['bomb-shield', '去除 1/3 炸弹', '降低本局炸弹压力；无尽模式可主动开启 20 秒。', 480, 99],
  ['coin-boost', '1.5 倍金币卡', '30 分钟内完成的对局，结算金币按 1.5 倍计算。', 900, 99],
  ['time-plus', '延时 10 秒', '普通或困难模式本局额外增加 10 秒。', 700, 99],
  ['score-boost', '分数 ×1.2', '无尽模式主动开启后，20 秒内新获得的分数按 1.2 倍计算。', 850, 99],
  ['energy-pack', '能量', '恢复 1 格能量；满能量时不可使用。', 320, 99],
])

function quoteDatabaseName(databaseName) {
  if (!DATABASE_NAME_PATTERN.test(databaseName)) throw new Error('Invalid MySQL database name')
  return `\`${databaseName}\``
}

function connectionConfig(config = {}) {
  const password = config.password ?? process.env.MYSQL_PASSWORD
  if (password === undefined) throw new Error('MYSQL_PASSWORD is required')
  return {
    host: config.host ?? process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(config.port ?? process.env.MYSQL_PORT ?? 3306),
    user: config.user ?? process.env.MYSQL_USER ?? 'root',
    password,
  }
}

function asTransaction(connection) {
  return {
    async query(sql, parameters = []) {
      const [rows] = await connection.query(sql, parameters)
      return rows
    },
    async execute(sql, parameters = []) {
      const [result] = await connection.execute(sql, parameters)
      return result
    },
  }
}

function presentWallet(player, now = new Date()) {
  const maxEnergy = Number(player.maxEnergy)
  let energy = Number(player.energy)
  const startedAt = player.energyRecoveryStartedAt ? new Date(player.energyRecoveryStartedAt) : null
  if (energy >= maxEnergy || !startedAt || Number.isNaN(startedAt.valueOf())) {
    return { coins: player.coins, energy, maxEnergy, energyRecoveryStartedAt: null }
  }
  const recovered = Math.floor((now.valueOf() - startedAt.valueOf()) / ENERGY_RECOVERY_INTERVAL_MS)
  if (recovered > 0) energy = Math.min(maxEnergy, energy + recovered)
  const nextRecoveryStartedAt = energy === maxEnergy
    ? null
    : new Date(startedAt.valueOf() + Math.max(0, recovered) * ENERGY_RECOVERY_INTERVAL_MS)
  return { coins: player.coins, energy, maxEnergy, energyRecoveryStartedAt: nextRecoveryStartedAt }
}

export async function createDatabase({ databaseName = process.env.MYSQL_DATABASE ?? 'fruit_party', config, dropOnDestroy } = {}) {
  const database = quoteDatabaseName(databaseName)
  const connection = connectionConfig(config)
  const bootstrap = await mysql.createConnection(connection)
  try {
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)
  } finally {
    await bootstrap.end()
  }

  const pool = mysql.createPool({
    ...connection,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE ?? 10),
    queueLimit: 0,
    enableKeepAlive: true,
    charset: 'utf8mb4',
    multipleStatements: true,
  })
  await pool.query(schema)
  const [testerModeColumn] = await pool.query("SHOW COLUMNS FROM users LIKE 'tester_mode_enabled'")
  if (!testerModeColumn.length) {
    await pool.query('ALTER TABLE users ADD COLUMN tester_mode_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER is_tester')
    await pool.query("UPDATE users SET tester_mode_enabled = 1 WHERE username = 'tester' AND is_tester = 1")
  }

  const shouldDropOnDestroy = dropOnDestroy ?? databaseName.startsWith('fruit_party_test_')
  return {
    async query(sql, parameters = []) {
      const [rows] = await pool.query(sql, parameters)
      return rows
    },
    async execute(sql, parameters = []) {
      const [result] = await pool.execute(sql, parameters)
      return result
    },
    async transaction(work) {
      const connectionHandle = await pool.getConnection()
      try {
        await connectionHandle.beginTransaction()
        const result = await work(asTransaction(connectionHandle))
        await connectionHandle.commit()
        return result
      } catch (error) {
        await connectionHandle.rollback()
        throw error
      } finally {
        connectionHandle.release()
      }
    },
    async destroy() {
      await pool.end()
      if (!shouldDropOnDestroy) return
      const cleanup = await mysql.createConnection(connection)
      try {
        await cleanup.query(`DROP DATABASE IF EXISTS ${database}`)
      } finally {
        await cleanup.end()
      }
    },
  }
}

export async function seedDatabase(db, hashPassword) {
  const seedUser = async ({ username, password, role = 'player', isTester = false, testerModeEnabled = false, coins = 0 }) => {
    await db.execute(`
      INSERT IGNORE INTO users (username, password_hash, role, is_tester, tester_mode_enabled, coins)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [username, hashPassword(password), role, isTester ? 1 : 0, testerModeEnabled ? 1 : 0, coins])
  }
  await seedUser({ username: 'tester', password: 'Tester123', isTester: true, testerModeEnabled: true, coins: 1000 })
  await seedUser({ username: 'admin', password: 'Admin123', role: 'admin' })
  await seedUser({ username: '水果达人', password: 'Player123', coins: 580 })
  await seedUser({ username: '一刀两半', password: 'Player123', coins: 420 })
  await seedUser({ username: '果香骑士', password: 'Player123', coins: 360 })
  await seedUser({ username: '晨露柠檬', password: 'Player123', coins: 280 })

  const catalogItems = CATALOG_ITEMS
  const legacyKeys = { 'bomb-clear-card': 'bomb-shield', 'score-boost-card': 'score-boost', 'energy-card': 'energy-pack' }
  for (const [legacyKey, itemKey] of Object.entries(legacyKeys)) {
    const [legacy] = await db.query('SELECT id FROM item_catalog WHERE item_key = ?', [legacyKey])
    const [current] = await db.query('SELECT id FROM item_catalog WHERE item_key = ?', [itemKey])
    if (legacy && !current) await db.execute('UPDATE item_catalog SET item_key = ? WHERE id = ?', [itemKey, legacy.id])
    if (legacy && current) await db.execute('UPDATE item_catalog SET enabled = 0, display_order = 99 WHERE id = ?', [legacy.id])
  }
  for (let index = 0; index < catalogItems.length; index += 1) {
    const [itemKey, displayName, description, priceCoins, maxPurchaseQuantity] = catalogItems[index]
    await db.execute(`
      INSERT INTO item_catalog (item_key, display_name, description, price_coins, max_purchase_quantity, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), description = VALUES(description),
        max_purchase_quantity = VALUES(max_purchase_quantity), display_order = VALUES(display_order), enabled = 1
    `, [itemKey, displayName, description, priceCoins, maxPurchaseQuantity, index])
  }
  const rechargeProducts = [
    ['永久能量', '永久获得无限能量。', 100, { infiniteEnergy: true }, 'https://example.com/recharge/permanent-energy.png'],
    ['一千金币', '获得 1000 枚金币。', 100, { coins: 1000 }, 'https://example.com/recharge/coins-1000.png'],
  ]
  for (let index = 0; index < rechargeProducts.length; index += 1) {
    const [displayName, description, priceCents, benefits, qrCodeUrl] = rechargeProducts[index]
    const existing = await db.query('SELECT id FROM recharge_products WHERE display_name = ? LIMIT 1', [displayName])
    if (!existing.length) await db.execute(`
      INSERT INTO recharge_products (display_name, description, price_cents, benefits, qr_code_url, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [displayName, description, priceCents, JSON.stringify(benefits), qrCodeUrl, index])
  }

  const users = await db.query('SELECT id, username, is_tester AS isTester FROM users')
  const userIds = Object.fromEntries(users.map((user) => [user.username, user.id]))
  for (const user of users) {
    for (const mode of ['normal', 'hard']) {
      for (const level of LEVELS) {
        await db.execute(`
          INSERT IGNORE INTO level_progress (user_id, mode, level_number, unlocked, best_score)
          VALUES (?, ?, ?, ?, 0)
        `, [user.id, mode, level, user.isTester || level === 1 ? 1 : 0])
      }
    }
  }

  const addSeededEndlessAttempt = async (username, baseScore, finalScore, hitRate, elapsedSeconds) => {
    const existing = await db.query('SELECT 1 FROM game_attempts WHERE user_id = ? AND mode = ? LIMIT 1', [userIds[username], 'endless'])
    if (existing.length) return
    await db.execute(`
      INSERT INTO game_attempts (user_id, mode, level_number, base_score, final_score, hit_rate, elapsed_seconds, passed)
      VALUES (?, 'endless', NULL, ?, ?, ?, ?, 0)
    `, [userIds[username], baseScore, finalScore, hitRate, elapsedSeconds])
  }
  await addSeededEndlessAttempt('水果达人', 73200, 98420, 0.82, 146)
  await addSeededEndlessAttempt('一刀两半', 66100, 86100, 0.79, 163)
  await addSeededEndlessAttempt('tester', 51300, 65600, 0.74, 188)
  await addSeededEndlessAttempt('果香骑士', 46900, 58400, 0.76, 174)
  await addSeededEndlessAttempt('晨露柠檬', 42200, 51800, 0.72, 196)

  const completeHardLevel = async (username, level, score) => {
    await db.execute(`
      UPDATE level_progress
      SET best_score = GREATEST(best_score, ?), completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
      WHERE user_id = ? AND mode = 'hard' AND level_number = ?
    `, [score, userIds[username], level])
  }
  for (let level = 1; level <= 5; level += 1) await completeHardLevel('水果达人', level, 500 + level * 170)
  for (let level = 1; level <= 4; level += 1) await completeHardLevel('一刀两半', level, 460 + level * 150)
  for (let level = 1; level <= 3; level += 1) await completeHardLevel('果香骑士', level, 440 + level * 140)
  for (let level = 1; level <= 2; level += 1) await completeHardLevel('晨露柠檬', level, 420 + level * 130)
  await completeHardLevel('tester', 1, 400)
}

export async function readPlayerState(db, userId) {
  const [player] = await db.query(`
    SELECT u.id, u.username, u.role, u.is_tester AS isTester, u.tester_mode_enabled AS testerModeEnabled,
           u.avatar_url AS avatarUrl, u.coins, u.energy, u.max_energy AS maxEnergy,
           u.energy_recovery_started_at AS energyRecoveryStartedAt, u.created_at AS createdAt,
           COALESCE(p.infinite_energy, 0) AS infiniteEnergy,
           COALESCE(p.infinite_coins, 0) AS infiniteCoins,
           COALESCE(p.unlock_all_levels, 0) AS unlockAllLevels
    FROM users u LEFT JOIN player_privileges p ON p.user_id = u.id
    WHERE u.id = ?
  `, [userId])
  if (!player) return null

  const testingModeEnabled = Boolean(player.isTester && player.testerModeEnabled)
  const wallet = presentWallet(player)
  const privileges = testingModeEnabled
    ? { infiniteEnergy: true, infiniteCoins: true, unlockAllLevels: true }
    : {
        infiniteEnergy: Boolean(player.infiniteEnergy),
        infiniteCoins: Boolean(player.infiniteCoins),
        unlockAllLevels: Boolean(player.unlockAllLevels),
      }

  const [progress, inventory, effects] = await Promise.all([db.query(`
    SELECT mode, level_number AS levelNumber, unlocked, best_score AS bestScore, completed_at AS completedAt
    FROM level_progress WHERE user_id = ? ORDER BY mode, level_number
  `, [userId]), db.query(`
    SELECT c.item_key AS itemKey, c.display_name AS displayName, c.description, i.quantity
    FROM player_inventory i JOIN item_catalog c ON c.id = i.item_id
    WHERE i.user_id = ? AND i.quantity > 0 AND c.enabled = 1
    ORDER BY c.display_order, c.id
  `, [userId]), db.query(`
    SELECT effect_key AS effectKey, expires_at AS expiresAt, uses_left AS usesLeft
    FROM player_effects WHERE user_id = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP OR uses_left > 0)
  `, [userId])])
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
    player: { id: player.id, username: player.username, role: player.role, isTester: Boolean(player.isTester), testingModeEnabled, avatarUrl: player.avatarUrl, createdAt: player.createdAt },
    wallet,
    inventory: inventory.map((item) => ({ ...item, quantity: Number(item.quantity) })),
    effects: effects.map((effect) => ({ ...effect, usesLeft: Number(effect.usesLeft) })),
    privileges,
    progress: modes,
  }
}

export async function readLeaderboards(db) {
  const endless = await db.query(`
    SELECT u.username AS name, MAX(a.final_score) AS score
    FROM game_attempts a JOIN users u ON u.id = a.user_id
    WHERE a.mode = 'endless' AND u.is_disabled = 0
    GROUP BY u.id, u.username ORDER BY score DESC, MIN(a.created_at) ASC LIMIT 5
  `)
  const hard = await db.query(`
    SELECT u.username AS name, COUNT(*) AS completedLevels
    FROM level_progress p JOIN users u ON u.id = p.user_id
    WHERE p.mode = 'hard' AND p.completed_at IS NOT NULL AND u.is_disabled = 0
    GROUP BY u.id, u.username ORDER BY completedLevels DESC, u.id ASC LIMIT 5
  `)
  return {
    endless: endless.map((entry, index) => ({ rank: index + 1, avatar: entry.name.slice(0, 1), name: entry.name, score: entry.score })),
    hard: hard.map((entry, index) => ({ rank: index + 1, avatar: entry.name.slice(0, 1), name: entry.name, score: `通关 ${entry.completedLevels} 关` })),
  }
}
