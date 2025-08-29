-- 0004_init_matches.sql
PRAGMA foreign_keys = ON;

-- Friendly/ladder matches (non-tournament)
CREATE TABLE IF NOT EXISTS matches(
	id	INTEGER PRIMARY KEY AUTOINCREMENT,
	player1_id	INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	player2_id	INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	status	TEXT NOT NULL DEFAULT 'pending',
	winner_id INTEGER REFERENCES users(id),
	score_p1	INTEGER,
	score_p2	INTEGER,
	created_at	TEXT NOT NULL DEFAULT ((strftime('%Y-%m-%d %H:%M:%f', 'now'))),
	CHECK (player1_id <> player2_id),
	CHECK (status IN ('pending', 'finished', 'canceled')),
	CHECK (winner_id IS NULL OR winner_id IN (player1_id, player2_id))
);

-- Speed up 'my matches' lists
CREATE INDEX IF NOT EXISTS idx_matches_p1_time ON matches(player1_id, created_at);
CREATE INDEX IF NOT EXISTS idx_matches_p2_time ON matches(player2_id, created_at);