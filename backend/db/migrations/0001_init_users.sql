-- 0001_init_users.sql

-- Turn on foreign keys (SQLite ships with them off unless you set this per-connection)
PRAGMA foreign_keys = ON;

-- Create the users table: one row per user
CREATE TABLE IF NOT EXISTS users (
	id					INTEGER PRIMARY KEY AUTOINCREMENT,	-- unique row id, auto-increments
	email				TEXT NOT NULL UNIQUE,				-- must be present, must be unique
	pseudo				TEXT NOT NULL UNIQUE,
	pwd_hash			TEXT NOT NULL,						-- bcrypt string
	is_2fa_enabled		INTEGER NOT NULL DEFAULT 0,			-- 0/1 stored as integer
	twofa_secret_enc	TEXT,								-- base64(nonce:ciphertext:tag) you encrypt in app
	avatar_url			TEXT,
	locale 				TEXT,
	created_at			TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')), -- UTC timestamp
	updated_at			TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

-- Auto-update the updated_at column on any update to a users row
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
	UPDATE users
	SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
	WHERE id = NEW.id;
END;

-- Index to speed up time-based reads
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_pseudo ON users(pseudo);