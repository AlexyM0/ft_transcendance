import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import { OAuth2Client } from "google-auth-library";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = fastify({ logger: true });
  const PORT = 3000;

  /* --------------------------------------------------------------
   *  PLUGINS
   * --------------------------------------------------------------*/
  await app.register(fastifyCors, { origin: true }); // allow all origins in dev

  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "devsecret123",
    sign: { expiresIn: "1h" },
  });

  /* --------------------------------------------------------------
   *  DATABASE
   * --------------------------------------------------------------*/
  mkdirSync("./data", { recursive: true });
  const dbPath = process.env.DB_PATH || "./data/main.db";
  const db = new Database(dbPath);
  app.decorate("db", db);

  const migrationPath = path.join(__dirname, "../migrations/001_create_users.sql");
  if (fs.existsSync(migrationPath)) {
    try {
      db.exec(fs.readFileSync(migrationPath, "utf8"));
      app.log.info("✅ SQL migration applied");
    } catch (e) {
      app.log.error("❌ Migration error", e);
    }
  } else {
    app.log.warn("❌ Migration file not found: " + migrationPath);
  }

  /* --------------------------------------------------------------
   *  VALIDATION CONSTANTS
   * --------------------------------------------------------------*/
  const USERNAME_REGEX = /^[A-Za-z0-9_-]{3,30}$/;       // 3-30 chars, alphanum + _ -
  const EMAIL_REGEX    = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i; // simple but solid
  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,128}$/; // 6-128

  /* --------------------------------------------------------------
   *  GOOGLE
   * --------------------------------------------------------------*/
  const GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID ||
    "215313879090-rshrl885bbbjmun6mcb1mmqao4vcl55g.apps.googleusercontent.com";
  const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

  /* --------------------------------------------------------------
   *  REGISTER
   * --------------------------------------------------------------*/
  app.post("/api/register", async (req, rep) => {
    const { pseudo, email, password } = req.body as {
      pseudo: string;
      email: string;
      password: string;
    };

    const pseudoNorm = pseudo?.trim();
    const emailNorm  = email?.trim().toLowerCase();

    // Validation
    if (!USERNAME_REGEX.test(pseudoNorm || "")) {
      return rep.code(400).send({ error: "Username: 3-30 letters, numbers, _ or -" });
    }
    if (!PASSWORD_REGEX.test(password || "")) {
      return rep.code(400).send({ error: "Password 6-128 chars, with upper, lower and digit" });
    }
    if (!EMAIL_REGEX.test(emailNorm || "") || emailNorm.length > 254) {
      return rep.code(400).send({ error: "Invalid email address" });
    }

    // Duplicate check
    const exists = db.prepare("SELECT id FROM users WHERE email = ? OR pseudo = ?").get(emailNorm, pseudoNorm) as { id: number } | undefined;
    if (exists) {
      return rep.code(409).send({ error: "Email or username already in use" });
    }

    const hash = await bcrypt.hash(password, 10);

    try {
      db.prepare("INSERT INTO users (email, pwd_hash, pseudo) VALUES (?, ?, ?)").run(emailNorm, hash, pseudoNorm);
      return rep.code(201).send({ ok: true });
    } catch (err: any) {
      app.log.error("Registration error", err);
      return rep.code(500).send({ error: "Internal server error" });
    }
  });

  /* --------------------------------------------------------------
   *  LOGIN (classic)
   * --------------------------------------------------------------*/
  app.post("/api/login", async (req, rep) => {
    const { email, password } = req.body as { email: string; password: string };
    const emailNorm = email.trim().toLowerCase();

    const row = db.prepare("SELECT id, pwd_hash, pseudo FROM users WHERE email = ?").get(emailNorm) as
      | { id: number; pwd_hash: string; pseudo: string }
      | undefined;

    if (!row || !(await bcrypt.compare(password, row.pwd_hash))) {
      return rep.code(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({ sub: row.id, email: emailNorm, pseudo: row.pseudo });
    return { token };
  });

  /* --------------------------------------------------------------
   *  LOGIN (Google OAuth)
   * --------------------------------------------------------------*/
  app.post("/api/login/google", async (req, rep) => {
    const { id_token } = req.body as { id_token: string };

    try {
      const ticket  = await googleClient.verifyIdToken({ idToken: id_token, audience: GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload?.email) throw new Error("no email");

      const email  = payload.email.toLowerCase();
      const pseudo = payload.given_name || email.split("@")[0];

      // upsert user
      db.prepare("INSERT OR IGNORE INTO users (email, pseudo, pwd_hash) VALUES (?, ?, '')").run(email, pseudo);
      const { id } = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number };

      const token = app.jwt.sign({ sub: id, email, pseudo });
      return { token };
    } catch {
      return rep.code(401).send({ error: "Invalid Google token" });
    }
  });

  /* --------------------------------------------------------------
   *  AUTH MIDDLEWARE & PROTECTED ENDPOINT
   * --------------------------------------------------------------*/
  app.decorate("auth", async (req: any, rep: any) => {
    try {
      await req.jwtVerify();
    } catch {
      return rep.code(401).send({ error: "Missing or invalid token" });
    }
  });

  app.get("/api/me", { preHandler: app.auth }, async (req) => {
    return { user: req.user };
  });

  /* --------------------------------------------------------------
   *  SERVER START
   * --------------------------------------------------------------*/
  app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`✅ Server up on http://localhost:${PORT}`);
  });
}

main();