-- 0005_init_tournaments.sql

PRAGMA foreign_keys = ON;

-- users(id INTEGER PRIMARY KEY, pseudo TEXT NOT NULL, avatar_url TEXT)

CREATE TABLE IF NOT EXISTS tournaments (
  tournament_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  owner_id         INTEGER NOT NULL REFERENCES users(id),
  max_players      INTEGER NOT NULL CHECK(max_players BETWEEN 2 AND 64),
  status           TEXT NOT NULL CHECK(status IN ('registration','ongoing','finished','canceled')) DEFAULT 'registration',
  settings_json    TEXT NOT NULL, -- JSON-encoded MatchSettings
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournament_players (
  tournament_id    INTEGER NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
  player_idx       INTEGER NOT NULL, -- stable index used by matches
  user_id          INTEGER NOT NULL REFERENCES users(id),
  name             TEXT NOT NULL, -- snapshot of user's pseudo (or a custom name)
  avatar_url	     TEXT,
  alias            TEXT,
  PRIMARY KEY (tournament_id, player_idx),
  UNIQUE (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  match_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id    INTEGER NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
  player1_idx      INTEGER NOT NULL,
  player2_idx      INTEGER NOT NULL,
  played           INTEGER NOT NULL DEFAULT 0,
  score_p1         INTEGER,
  score_p2         INTEGER
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_tournaments_owner ON tournaments(owner_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tplayers_tournament ON tournament_players(tournament_id);
