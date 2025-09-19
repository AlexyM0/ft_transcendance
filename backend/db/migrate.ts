// migrate.ts
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// In Docker and prod, process.cwd() === "/app"
const ROOT = process.cwd();

// Where the SQL files live at runtime:
const MIGRATIONS_DIR = path.resolve(ROOT, "db", "migrations");

// Where the SQLite file lives (same path your app uses):
const DB_PATH = process.env.DB_FILE || path.resolve(ROOT, "db", "transcendance.db");

// Safety checks (useful logs)
if (!fs.existsSync(MIGRATIONS_DIR)) {
  throw new Error(`[migrate] Migrations directory not found: ${MIGRATIONS_DIR}`);
}

// Ensure parent dir for DB exists (in case it’s not created yet)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

db.exec(`
		CREATE TABLE IF NOT EXISTS _migrations (
			filename	TEXT PRIMARY KEY,
		applied_at	TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
		);
		`);

const filenames = db.prepare("SELECT filename FROM _migrations").all() as any[];
const applied = new Set<string>(filenames.map((r) => r.filename));

const files: string[] = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  if (applied.has(file)) continue;

  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
  const tx = db.transaction(() => {
    db.exec(sql);
    db.prepare("INSERT INTO _migrations (filename) VALUES (?)").run(file);
  });
  try {
    tx();
    console.log(`✅ Applied ${file}`);
  } catch (e) {
    console.error(`🔴 Failed ${file}: `, e);
  }
}

console.log("All migrations are up to date");
