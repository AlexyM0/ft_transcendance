import { join } from "node:path";
import { promises as fs } from "node:fs";
import Database from "better-sqlite3";          // déjà présent via fastify-sqlite

const dbPath = process.env.DB_PATH || "/data/main.db";
const db = new Database(dbPath);

// Migration 001 - Create users
const sql1 = await fs.readFile(
  join(import.meta.dirname, "../migrations/001_create_users.sql"),
  "utf-8"
);
db.exec(sql1);
console.log("✅ Migration 001 applied");

// Migration 002 - Create stats and tournaments
const sql2 = await fs.readFile(
  join(import.meta.dirname, "../migrations/002_create_stats_and_tournaments.sql"),
  "utf-8"
);
db.exec(sql2);
console.log("✅ Migration 002 applied");
