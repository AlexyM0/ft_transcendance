import { join } from "node:path";
import { promises as fs } from "node:fs";
import Database from "better-sqlite3";          // déjà présent via fastify-sqlite

const dbPath = process.env.DB_PATH || "/data/main.db";
const db = new Database(dbPath);
const sql = await fs.readFile(
  join(import.meta.dirname, "../migrations/001_create_users.sql"),
  "utf-8"
);
db.exec(sql);
console.log("✅ migration applied");
