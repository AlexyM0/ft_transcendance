import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const app = fastify();

/* ─── JWT ───────────────────────────────────────── */
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || "devsecret123",
  sign: { expiresIn: "1h" }
});

/* ─── SQLite : ouverture directe ────────────────── */
const dbPath = process.env.DB_PATH || "/data/main.db";
const db = new Database(dbPath);
app.decorate("db", db); // accessible via app.db

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    email     TEXT UNIQUE NOT NULL,
    pwd_hash  TEXT NOT NULL
  );
`);

/* ─── inscription ──────────────────────────────── */
app.post("/api/register", async (req, rep) => {
  const { email, password } = req.body as { email: string; password: string };
  const hash = await bcrypt.hash(password, 10);
  try {
    db.prepare(
      "INSERT INTO users (email, pwd_hash) VALUES (?, ?)"
    ).run(email.toLowerCase(), hash);
    return rep.code(201).send({ ok: true });
  } catch {
    return rep.code(409).send({ error: "email déjà utilisé" });
  }
});

/* ─── connexion ─────────────────────────────────── */
app.post("/api/login", async (req, rep) => {
  const { email, password } = req.body as { email: string; password: string };

  type UserRow = { id: number; pwd_hash: string };
  const row = db
    .prepare("SELECT id, pwd_hash FROM users WHERE email = ?")
    .get(email.toLowerCase()) as UserRow | undefined;

  if (!row || !(await bcrypt.compare(password, row.pwd_hash))) {
    return rep.code(401).send({ error: "mauvais identifiants" });
  }

  const token = app.jwt.sign({ sub: row.id, email });
  return { token };
});

/* ─── middleware auth ───────────────────────────── */
app.decorate("auth", async (req: any, rep: any) => {
  try {
    await req.jwtVerify();
  } catch {
    return rep.code(401).send({ error: "token manquant / invalide" });
  }
});

/* ─── route protégée ────────────────────────────── */
app.get("/api/me", { preHandler: app.auth }, async req => {
  return { user: req.user };
});

/* ─── ping ──────────────────────────────────────── */
app.get("/api/ping", async () => ({ pong: true }));

/* ─── start ─────────────────────────────────────── */
app.listen({ host: "0.0.0.0", port: 3000 });
