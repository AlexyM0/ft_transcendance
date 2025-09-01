-- 0005_init_tournaments.sql

PRAGMA foreign_keys = ON;

-- Tournament metadata
CREATE TABLE IF NOT EXISTS tournaments(
	id	INTEGER PRIMARY KEY AUTOINCREMENT,
	owner_id	INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title		TEXT NOT NULL,
	description	TEXT,
	max_players	INTEGER NOT NULL DEFAULT 8,
	status		TEXT NOT NULL DEFAULT 'registration',
	created_at	TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
	started_at	TEXT,
	ended_at	TEXT,
	CHECK (max_players >= 2 AND max_players <= 256),
	CHECK (status IN ('registration', 'ongoing', 'finished', 'canceled'))
);

-- Who joined which tournament
CREATE TABLE IF NOT EXISTS tournament_participants(
	tournament_id	INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
	user_id			INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	joined_at		TEXT NOT NULL  DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
	PRIMARY KEY (tournament_id, user_id)
);

-- Bracket matches per round inside a tournament
CREATE TABLE IF NOT EXISTS tournament_matches(
	id	INTEGER PRIMARY KEY AUTOINCREMENT,
	tournament_id	INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
	round	INTEGER NOT NULL,
	player1_id	INTEGER REFERENCES users(id),
	player2_id	INTEGER REFERENCES users(id),
	winner_id	INTEGER REFERENCES users(id),
	score_p1	INTEGER,
	score_p2	INTEGER,
	created_at	TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
	CHECK(player1_id IS NULL OR player1_id <> player2_id),
	CHECK(winner_id IS NULL OR winner_id IN (player1_id, player2_id))
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_tournaments_owner ON tournaments(owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tparticipants_user ON tournament_participants(user_id, tournament_id);
CREATE INDEX IF NOT EXISTS idx_tmaches_round ON tournament_matches(tournament_id, round);