import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/user.js";
// Corrige __dirname pour les modules ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = fastify({ logger: true });
  const PORT = 3000;

  // CORS — toutes origines en dev
  await app.register(fastifyCors, { origin: true });

  // JWT
  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "devsecret123",
    sign: { expiresIn: "1h" },
  });

  // Dossier data (si DB locale)
  mkdirSync("./data", { recursive: true });

  // Chemin de la base (var env ou défaut)
  const dbPath = process.env.DB_PATH || "./data/main.db";

  // Connexion SQLite
  const db = new Database(dbPath);
  app.decorate("db", db);

  // Migration 001 (crée la table avec pseudo NOT NULL UNIQUE)
  const migrationPath = path.join(
    __dirname,
    "../migrations/001_create_users.sql"
  );
  if (fs.existsSync(migrationPath)) {
    try {
      db.exec(fs.readFileSync(migrationPath, "utf8"));
      app.log.info("✅ Migration SQL appliquée");
    } catch (e) {
      app.log.error("❌ Erreur migration", e);
    }
  } else {
    app.log.warn("❌ Fichier migration introuvable : " + migrationPath);
  }

  /* ------------------------------------------------------------------
   *  MIDDLEWARE AUTH
   * ----------------------------------------------------------------*/
  app.decorate("auth", async (req: any, rep: any) => {
    try {
      await req.jwtVerify();
    } catch {
      return rep.code(401).send({ error: "token manquant / invalide" });
    }
  });

  await app.register(authRoutes);
  await app.register(userRoutes);

  // Start server
  app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`✅ Serveur en ligne sur http://localhost:${PORT}`);
  });
}

main();
