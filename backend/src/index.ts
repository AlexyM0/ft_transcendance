import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

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
  const migrationPath = path.join(__dirname, "../migrations/001_create_users.sql");
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
   *  ROUTE D'INSCRIPTION
   * ----------------------------------------------------------------*/
  app.post("/api/register", async (req, rep) => {
    console.log("🛬 register body ➜", req.body);
    const { pseudo, email, password } = req.body as {
      pseudo: string;
      email: string;
      password: string;
    };

    if (!pseudo?.trim()) {
      return rep.code(400).send({ error: "pseudo obligatoire" });
    }

    const hash = await bcrypt.hash(password, 10);

    try {
      db.prepare(
        "INSERT INTO users (email, pwd_hash, pseudo) VALUES (?, ?, ?)"
      ).run(email.toLowerCase(), hash, pseudo.trim());

      return rep.code(201).send({ ok: true });
    } catch (err: any) {
      app.log.error("Erreur inscription", err);
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return rep.code(409).send({ error: "email ou pseudo déjà utilisé" });
      }
      return rep.code(500).send({ error: "Erreur interne" });
    }
  });

  /* ------------------------------------------------------------------
   *  ROUTE DE CONNEXION
   * ----------------------------------------------------------------*/
  app.post("/api/login", async (req, rep) => {
    const { email, password } = req.body as { email: string; password: string };

    const row = db.prepare(
      "SELECT id, pwd_hash, pseudo FROM users WHERE email = ?"
    ).get(email.toLowerCase()) as
      | { id: number; pwd_hash: string; pseudo: string }
      | undefined;

    if (!row || !(await bcrypt.compare(password, row.pwd_hash))) {
      return rep.code(401).send({ error: "mauvais identifiants" });
    }

    const token = app.jwt.sign({ sub: row.id, email, pseudo: row.pseudo });
    return { token };
  });

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

  /* ------------------------------------------------------------------
   *  ROUTE PROTÉGÉE
   * ----------------------------------------------------------------*/
  app.get("/api/me", { preHandler: app.auth }, async (req) => {
    return { user: req.user }; // contient maintenant pseudo
  });

  // Start server
  app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`✅ Serveur en ligne sur http://localhost:${PORT}`);
  });
}

main();
