-- 0003_init_chats.sql

PRAGMA foreign_keys = ON;

-- One chat per unique user pair, stored as (min, max) using CHECK
CREATE TABLE IF NOT EXISTS chats(
	id	INTEGER PRIMARY KEY AUTOINCREMENT,
	user_a_id	INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	user_b_id	INTEGER NOT NuLL REFERENCES users(id) ON DELETE CASCADE,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
	UNIQUE	(user_a_id, user_b_id),
	CHECK	(user_a_id < user_b_id)
);

-- Append-only messages table
CREATE TABLE IF NOT EXISTS messages (
	id	INTEGER PRIMARY KEY AUTOINCREMENT,
	chat_id	INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
	author_id	INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	body	TEXT NOT NULL,
	created_at	TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
	CHECK (length(body) > 0 AND length(body) <= 1000)
);

-- Read chat histories fast in chronological order
CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chats_user_a ON chats(user_a_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_b ON chats(user_b_id);