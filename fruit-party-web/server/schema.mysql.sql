CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(48) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('player', 'admin') NOT NULL DEFAULT 'player',
  is_tester TINYINT(1) NOT NULL DEFAULT 0,
  tester_mode_enabled TINYINT(1) NOT NULL DEFAULT 0,
  is_disabled TINYINT(1) NOT NULL DEFAULT 0,
  disabled_at DATETIME NULL,
  avatar_url VARCHAR(2048) NULL,
  coins INT UNSIGNED NOT NULL DEFAULT 0,
  energy TINYINT UNSIGNED NOT NULL DEFAULT 5,
  max_energy TINYINT UNSIGNED NOT NULL DEFAULT 5,
  energy_recovery_started_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_unique (username),
  CONSTRAINT users_energy_bound CHECK (energy <= max_energy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS level_progress (
  user_id BIGINT UNSIGNED NOT NULL,
  mode ENUM('normal', 'hard') NOT NULL,
  level_number TINYINT UNSIGNED NOT NULL,
  unlocked TINYINT(1) NOT NULL DEFAULT 0,
  best_score INT UNSIGNED NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  PRIMARY KEY (user_id, mode, level_number),
  CONSTRAINT level_progress_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT level_progress_level_bound CHECK (level_number BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS game_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  mode ENUM('normal', 'hard', 'endless') NOT NULL,
  level_number TINYINT UNSIGNED NULL,
  base_score INT UNSIGNED NOT NULL,
  final_score INT UNSIGNED NOT NULL,
  hit_rate DECIMAL(5,4) NOT NULL,
  elapsed_seconds INT UNSIGNED NOT NULL,
  passed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY game_attempts_mode_score_idx (mode, final_score DESC, created_at ASC),
  KEY game_attempts_user_mode_idx (user_id, mode),
  CONSTRAINT game_attempts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT game_attempts_level_bound CHECK (level_number IS NULL OR level_number BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS player_privileges (
  user_id BIGINT UNSIGNED NOT NULL,
  infinite_energy TINYINT(1) NOT NULL DEFAULT 0,
  infinite_coins TINYINT(1) NOT NULL DEFAULT 0,
  unlock_all_levels TINYINT(1) NOT NULL DEFAULT 0,
  granted_by BIGINT UNSIGNED NULL,
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT player_privileges_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT player_privileges_granted_by_fk FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS item_catalog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_key VARCHAR(64) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  price_coins INT UNSIGNED NOT NULL,
  max_purchase_quantity TINYINT UNSIGNED NOT NULL DEFAULT 99,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY item_catalog_key_unique (item_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS player_inventory (
  user_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, item_id),
  CONSTRAINT player_inventory_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT player_inventory_item_fk FOREIGN KEY (item_id) REFERENCES item_catalog(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS player_effects (
  user_id BIGINT UNSIGNED NOT NULL,
  effect_key VARCHAR(64) NOT NULL,
  expires_at DATETIME NULL,
  uses_left INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, effect_key),
  CONSTRAINT player_effects_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  transaction_type VARCHAR(32) NOT NULL,
  reference_type VARCHAR(32) NOT NULL,
  reference_id VARCHAR(64) NOT NULL,
  coins_delta INT NOT NULL,
  balance_after INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY wallet_ledger_reference_unique (user_id, reference_type, reference_id),
  KEY wallet_ledger_user_time_idx (user_id, created_at DESC),
  CONSTRAINT wallet_ledger_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT wallet_ledger_delta_nonzero CHECK (coins_delta <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS shop_purchase_receipts (
  user_id BIGINT UNSIGNED NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  quantity TINYINT UNSIGNED NOT NULL,
  charged_coins INT UNSIGNED NOT NULL,
  remaining_coins INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, request_id),
  CONSTRAINT shop_purchase_receipts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT shop_purchase_receipts_item_fk FOREIGN KEY (item_id) REFERENCES item_catalog(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notification_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  audience ENUM('all', 'selected') NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT notification_messages_author_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notification_recipients (
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (notification_id, user_id),
  KEY notification_recipients_user_idx (user_id, deleted_at, read_at),
  CONSTRAINT notification_recipients_message_fk FOREIGN KEY (notification_id) REFERENCES notification_messages(id) ON DELETE CASCADE,
  CONSTRAINT notification_recipients_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS recharge_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  display_name VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  price_cents INT UNSIGNED NOT NULL,
  benefits JSON NOT NULL,
  qr_code_url VARCHAR(2048) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS recharge_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'paid', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
  qr_code_url VARCHAR(2048) NULL,
  expires_at DATETIME NOT NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY recharge_orders_order_no_unique (order_no),
  KEY recharge_orders_user_status_idx (user_id, status, created_at DESC),
  CONSTRAINT recharge_orders_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT recharge_orders_product_fk FOREIGN KEY (product_id) REFERENCES recharge_products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  details JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY admin_audit_logs_admin_time_idx (admin_id, created_at DESC),
  CONSTRAINT admin_audit_logs_admin_fk FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS game_sessions (
  id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  mode ENUM('normal', 'hard', 'endless') NOT NULL,
  level_number TINYINT UNSIGNED NULL,
  status ENUM('active', 'settled', 'abandoned') NOT NULL DEFAULT 'active',
  attempt_id BIGINT UNSIGNED NULL,
  settlement_nonce CHAR(36) NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY game_sessions_nonce_unique (settlement_nonce),
  KEY game_sessions_user_status_idx (user_id, status, started_at DESC),
  CONSTRAINT game_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT game_sessions_attempt_fk FOREIGN KEY (attempt_id) REFERENCES game_attempts(id) ON DELETE SET NULL,
  CONSTRAINT game_sessions_level_bound CHECK (level_number IS NULL OR level_number BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
