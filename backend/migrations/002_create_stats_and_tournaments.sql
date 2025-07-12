-- Table user_stats
CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    win_ratio REAL DEFAULT 0.0,
    total_score INTEGER DEFAULT 0,
    best_score INTEGER DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table match_history
CREATE TABLE IF NOT EXISTS match_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER NOT NULL,
    player2_id INTEGER NOT NULL,
    winner_id INTEGER,
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    match_type TEXT DEFAULT '1v1',
    match_date DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
    duration INTEGER DEFAULT 0,
    tournament_id INTEGER DEFAULT NULL,
    status TEXT DEFAULT 'completed',
    FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL
);

-- Table tournaments
CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    max_players INTEGER DEFAULT 8,
    current_players INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    winner_id INTEGER DEFAULT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
    started_at DATETIME DEFAULT NULL,
    ended_at DATETIME DEFAULT NULL,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Trigger pour mise à jour automatique user_stats
CREATE TRIGGER IF NOT EXISTS trg_user_stats_update
AFTER UPDATE ON user_stats
FOR EACH ROW
BEGIN
    UPDATE user_stats SET updated_at = strftime('%Y-%m-%d %H:%M:%f','now')
    WHERE id = NEW.id;
END;

-- Trigger pour calculer automatiquement le win_ratio
CREATE TRIGGER IF NOT EXISTS trg_calculate_win_ratio
AFTER UPDATE ON user_stats
FOR EACH ROW
BEGIN
    UPDATE user_stats 
    SET win_ratio = CASE 
        WHEN NEW.games_played > 0 THEN ROUND((NEW.wins * 1.0) / NEW.games_played, 3)
        ELSE 0.0 
    END
    WHERE id = NEW.id;
END;