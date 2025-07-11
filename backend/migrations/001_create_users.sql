CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pseudo      TEXT    NOT NULL UNIQUE,
  email       TEXT    NOT NULL UNIQUE,
  pwd_hash    TEXT    NOT NULL,
  nb_games    INTEGER NOT NULL DEFAULT 0,
  is2fa       INTEGER NOT NULL DEFAULT 0,
  totp_secret TEXT,  
  avatar      TEXT    NOT NULL DEFAULT '/static/avatars/default.png',
  locale      TEXT,
  created_at  DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  updated_at  DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now'))
);

CREATE TRIGGER IF NOT EXISTS trg_users_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = strftime('%Y-%m-%d %H:%M:%f','now')
  WHERE id = NEW.id;
END;