-- 0007_init_twofa_enrollments.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS twofa_enrollments (
	user_id	INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	secret_enc TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_twofa_enrollments_created ON twofa_enrollments(created_at);