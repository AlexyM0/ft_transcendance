// db.ts
import Database from "better-sqlite3";
import path from "path";

// In Docker and prod, process.cwd() === "/app"
const ROOT = process.cwd();

// Where the SQL files live at runtime:
const MIGRATIONS_DIR = path.resolve(ROOT, "db", "migrations");

// Where the SQLite file lives (same path your app uses):
const DB_PATH = process.env.DB_FILE || path.resolve(ROOT, "db", "transcendance.db");

/**
 * db is of type Database. Using InstanceType is just to silent the TS warning
 */
export const db: InstanceType<typeof Database> = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

export function withTx<T>(fn: () => T): T {
  const run = db.transaction(fn);
  return run();
}
