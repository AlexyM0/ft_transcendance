-- 0002_init_friendships.sql
PRAGMA foreign_keys = ON;

-- Friends requests (pending/accepted/declined). One row per request
CREATE TABLE IF NOT EXISTS friend_requests (
	id				INTEGER PRIMARY KEY AUTOINCREMENT,
	from_user_id	INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Foreign Key: if user is deleted, remove requests
	to_user_id		INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
	status			TEXT NOT NULL DEFAULT 'pending',							-- enum via check below
	created_at		TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
	UNIQUE (from_user_id, to_user_id),											-- prevent duplicates
	CHECK (status IN ('pending', 'accepted', 'declined')),
	CHECK (from_user_id <> to_user_id)											-- cannot friend yourself
);

-- Accepted friendships : one row per pair, stored in canonical order (user_id < friend_id)
CREATE TABLE IF NOT EXISTS friendships (
	user_id		INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	friend_id	INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at	TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
	PRIMARY KEY (user_id, friend_id),
	CHECK (user_id < friend_id)
);

-- Helpful indexes for listing/looking up requests
CREATE INDEX IF NOT EXISTS idx_frequests_to_status ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_frequests_from_status ON friend_requests(from_user_id, status);

-- Extra indexes for friendship lists
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_pair ON friendships(user_id, friend_id);
