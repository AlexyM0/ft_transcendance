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
  const app = fastify();
  const PORT = 3000;

  await app.register(fastifyCors, {
    origin: true, // autorise toutes les origines
  });

  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "devsecret123",
    sign: { expiresIn: "1h" },
  });

  // Créer le dossier data si nécessaire
  mkdirSync("./data", { recursive: true });

  // Connexion à la base de données
  const db = new Database("./data/main.db");
  app.decorate("db", db);

  // Appliquer la migration SQL
  const migrationPath = path.join(__dirname, "../migrations/001_create_users.sql");
  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, "utf8");
    db.exec(sql);
    console.log("✅ Migration SQL appliquée");
  } else {
    console.error("❌ Fichier SQL manquant :", migrationPath);
  }

  // Route d'inscription
  app.post("/api/register", async (req, rep) => {
    const { email, password } = req.body as { email: string; password: string };
    const hash = await bcrypt.hash(password, 10);

    try {
      db.prepare("INSERT INTO users (email, pwd_hash) VALUES (?, ?)").run(email.toLowerCase(), hash);
      return rep.code(201).send({ ok: true });
    } catch (err: any) {
      console.error("Erreur lors de l'inscription :", err);
      return rep.code(500).send({ error: "Erreur interne lors de l'inscription" });
    }
  });

  // Route de connexion
  app.post("/api/login", async (req, rep) => {
    const { email, password } = req.body as { email: string; password: string };

    const row = db
      .prepare("SELECT id, pwd_hash FROM users WHERE email = ?")
      .get(email.toLowerCase()) as { id: number; pwd_hash: string } | undefined;

    if (!row || !(await bcrypt.compare(password, row.pwd_hash))) {
      return rep.code(401).send({ error: "mauvais identifiants" });
    }

    const token = app.jwt.sign({ sub: row.id, email });
    return { token };
  });

  // Middleware d'authentification
  app.decorate("auth", async (req: any, rep: any) => {
    try {
      await req.jwtVerify();
    } catch {
      return rep.code(401).send({ error: "token manquant / invalide" });
    }
  });

  // Route protégée
  app.get("/api/me", { preHandler: app.auth }, async (req) => {
    return { user: req.user };
  });

  // Démarrer le serveur
  app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`✅ Serveur en ligne sur http://localhost:${PORT}`);
  });
}

main();
