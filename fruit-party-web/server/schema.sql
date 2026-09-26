PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('player', 'admin')),
  is_tester INTEGER NOT NULL DEFAULT 0 CHECK(is_tester IN (0, 1)),
  avatar_url TEXT,
  coins INTEGER NOT NULL DEFAULT 0 CHECK(coins >= 0),
  energy INTEGER NOT NULL DEFAULT 5 CHECK(energy >= 0),
  max_energy INTEGER NOT NULL DEFAULT 5 CHECK(max_energy > 0),
  energy_recovery_started_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS level_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK(mode IN ('normal', 'hard')),
  level_number INTEGER NOT NULL CHECK(level_number BETWEEN 1 AND 10),
  unlocked INTEGER NOT NULL DEFAULT 0 CHECK(unlocked IN (0, 1)),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK(best_score >= 0),
  completed_at TEXT,
  PRIMARY KEY (user_id, mode, level_number)
);

CREATE TABLE IF NOT EXISTS game_attempts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK(mode IN ('normal', 'hard', 'endless')),
  level_number INTEGER,
  base_score INTEGER NOT NULL CHECK(base_score >= 0),
  final_score INTEGER NOT NULL CHECK(final_score >= 0),
  hit_rate REAL NOT NULL CHECK(hit_rate BETWEEN 0 AND 1),
  elapsed_seconds INTEGER NOT NULL CHECK(elapsed_seconds >= 0),
  passed INTEGER NOT NULL DEFAULT 0 CHECK(passed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS game_attempts_mode_score_idx
  ON game_attempts(mode, final_score DESC, created_at ASC);
