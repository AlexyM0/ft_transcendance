-- 0006_init_user_stats.sql

PRAGMA foreign_keys = ON;

-- Denormalized stats cache you update from code after results are recorded
CREATE TABLE IF NOT EXISTS user_stats(
	user_id			INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	wins			INTEGER NOT NULL DEFAULT 0,
	losses			INTEGER NOT NULL DEFAULT 0,
	games_played	INTEGER NOT NULL DEFAULT 0,
	win_ratio		REAL NOT NULL DEFAULT 0.0,
	total_score		INTEGER NOT NULL DEFAULT 0,
	best_score		INTEGER NOT NULL DEFAULT 0,
	updated_at		TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);