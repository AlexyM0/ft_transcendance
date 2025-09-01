// db.ts
import Database from "better-sqlite3";
import path from "path";

const DB_DIR = path.join(__dirname, "../../db");
const DB_PATH = path.join(DB_DIR, "transcendance.db");

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
