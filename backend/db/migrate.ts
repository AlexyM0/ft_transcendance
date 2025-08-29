// migrate.ts
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const DB_PATH = path.join(__dirname, "transcendance.db");

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
