-- Table pour les relations d'amis
CREATE TABLE IF NOT EXISTS user_friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'blocked'
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Contraintes
    UNIQUE(user_id, friend_id),  -- Pas de doublons
    CHECK(user_id != friend_id)  -- Pas s'ajouter soi-même
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_user_friends_user_id ON user_friends(user_id);
CREATE INDEX IF NOT EXISTS idx_user_friends_friend_id ON user_friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_user_friends_status ON user_friends(status);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER IF NOT EXISTS trg_user_friends_updated_at
AFTER UPDATE ON user_friends
BEGIN
    UPDATE user_friends SET updated_at = strftime('%Y-%m-%d %H:%M:%f','now') 
    WHERE id = NEW.id;
END;