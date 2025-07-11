//-----------------------------------------------------------------
//  src/index.ts – Fastify + JWT + 2FA (TOTP)
//-----------------------------------------------------------------
import fastify, {
  FastifyRequest,
  FastifyReply,
  RouteShorthandOptions,
} from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import { OAuth2Client } from "google-auth-library";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

// ──────────────────────────────────────────────────────────────────
//  __dirname fix (ESM)
// ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ──────────────────────────────────────────────────────────────────
//  Main
// ──────────────────────────────────────────────────────────────────
async function main() {
  const app = fastify({ logger: true });
  const PORT = 3000;

  // ------------------------------------------------- PLUGINS
  await app.register(fastifyCors, { origin: true });
  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "devsecret123",
  });

  // ------------------------------------------------- DATABASE
  mkdirSync("./data", { recursive: true });
  const dbPath = process.env.DB_PATH || "./data/main.db";
  const db = new Database(dbPath);
  app.decorate("db", db);

  const migrationPath = path.join(
    __dirname,
    "../migrations/001_create_users.sql"
  );
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

  // ------------------------------------------------- VALIDATION
  const USERNAME_REGEX = /^[A-Za-z0-9_-]{3,30}$/;
  const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,128}$/;

  // ------------------------------------------------- GOOGLE
  const GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID ||
    "215313879090-rshrl885bbbjmun6mcb1mmqao4vcl55g.apps.googleusercontent.com";
  const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

  // ------------------------------------------------- HELPERS
  /** protège une route pour un token dont `user.stage === stage` */
  const stageGuard = (stage: string) => {
    return {
      preHandler: async (req: FastifyRequest, rep: FastifyReply) => {
        try {
          // @ts-ignore – ajouté par fastify-jwt
          await (req as any).jwtVerify();
          // @ts-ignore – user enrichi
          if ((req as any).user.stage !== stage) throw new Error();
        } catch {
          return rep.code(401).send({ error: "Invalid or expired token" });
        }
      },
    } as RouteShorthandOptions;
  };

  // ───────────────────────────────────────────────────────────────
  //  REGISTER
  // ───────────────────────────────────────────────────────────────
  app.post("/api/register", async (req, rep) => {
    const { pseudo, email, password } = req.body as {
      pseudo: string;
      email: string;
      password: string;
    };

    const pseudoNorm = pseudo?.trim();
    const emailNorm = email?.trim().toLowerCase();

    if (!USERNAME_REGEX.test(pseudoNorm || ""))
      return rep.code(400).send({ error: "Username invalid" });
    if (!PASSWORD_REGEX.test(password || ""))
      return rep.code(400).send({ error: "Password too weak" });
    if (!EMAIL_REGEX.test(emailNorm || ""))
      return rep.code(400).send({ error: "Email invalid" });

    const exists = db
      .prepare("SELECT id FROM users WHERE email = ? OR pseudo = ?")
      .get(emailNorm, pseudoNorm);
    if (exists) return rep.code(409).send({ error: "Already used" });

    const hash = await bcrypt.hash(password, 10);
    const r = db
      .prepare("INSERT INTO users (email, pwd_hash, pseudo) VALUES (?, ?, ?)")
      .run(emailNorm, hash, pseudoNorm);

    // token temporaire pour configurer la 2FA
    const setupToken = app.jwt.sign(
      { sub: r.lastInsertRowid, stage: "setup-2fa" },
      { expiresIn: "15m" }
    );
    return rep.code(201).send({ setupToken });
  });

  // ───────────────────────────────────────────────────────────────
  //  2-FA SETUP  (QR  |  verify  |  skip)
  // ───────────────────────────────────────────────────────────────
  // 1) Obtenir un QR Code
  app.get("/auth/2fa/qr", stageGuard("setup-2fa"), async (req: any) => {
    const secret = speakeasy.generateSecret({ name: "FT_Transcendance" });
    db.prepare("UPDATE users SET totp_secret = ? WHERE id = ?").run(
      secret.base32,
      req.user.sub
    );
    const qr = await QRCode.toDataURL(secret.otpauth_url!);
    return { qr };
  });

  // 2) Vérifier le code et activer la 2FA
  app.post("/auth/2fa/verify", stageGuard("setup-2fa"), (req: any, rep) => {
    const { code } = req.body as { code: string };
    const row = db
      .prepare("SELECT totp_secret FROM users WHERE id = ?")
      .get(req.user.sub) as { totp_secret: string };

    const ok = speakeasy.totp.verify({
      token: code,
      secret: row.totp_secret,
      encoding: "base32",
      window: 1,
    });
    if (!ok) return rep.code(400).send({ error: "Bad code" });

    db.prepare("UPDATE users SET is2fa = 1 WHERE id = ?").run(req.user.sub);
    const sessionToken = app.jwt.sign({ sub: req.user.sub });
    return { sessionToken };
  });

  // 3) L’utilisateur choisit « Plus tard »
  app.post("/auth/2fa/skip", stageGuard("setup-2fa"), (req: any) => {
    const sessionToken = app.jwt.sign({ sub: req.user.sub });
    return { sessionToken };
  });

  // ───────────────────────────────────────────────────────────────
  //  LOGIN classique
  // ───────────────────────────────────────────────────────────────
  app.post("/api/login", async (req, rep) => {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };
    const emailNorm = email.trim().toLowerCase();

    const row = db
      .prepare(
        "SELECT id, pwd_hash, pseudo, is2fa FROM users WHERE email = ?"
      )
      .get(emailNorm) as
      | { id: number; pwd_hash: string; pseudo: string; is2fa: number }
      | undefined;

    if (!row || !(await bcrypt.compare(password, row.pwd_hash)))
      return rep.code(401).send({ error: "Invalid credentials" });

    // si 2FA activée ➜ on renvoie un token « challenge »
    if (row.is2fa) {
      const challengeToken = app.jwt.sign(
        { sub: row.id, stage: "2fa-challenge" },
        { expiresIn: "10m" }
      );
      return { challengeToken };
    }

    // sinon, session directe
    const sessionToken = app.jwt.sign({
      sub: row.id,
      email: emailNorm,
      pseudo: row.pseudo,
    });
    return { sessionToken };
  });

  // Vérification du code TOTP lors du challenge
  app.post("/auth/2fa/login-verify", stageGuard("2fa-challenge"), (req: any, rep) => {
    const { code } = req.body as { code: string };
    const row = db
      .prepare("SELECT totp_secret FROM users WHERE id = ?")
      .get(req.user.sub) as { totp_secret: string };

    const ok = speakeasy.totp.verify({
      token: code,
      secret: row.totp_secret,
      encoding: "base32",
      window: 1,
    });
    if (!ok) return rep.code(400).send({ error: "Bad code" });

    const sessionToken = app.jwt.sign({ sub: req.user.sub });
    return { sessionToken };
  });

  // ───────────────────────────────────────────────────────────────
  //  LOGIN via Google OAuth
  // ───────────────────────────────────────────────────────────────
  app.post("/api/login/google", async (req, rep) => {
    const { id_token } = req.body as { id_token: string };
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: id_token,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) throw new Error("no email");

      const email = payload.email.toLowerCase();
      const pseudo = payload.given_name || email.split("@")[0];

      // upsert user
      db.prepare(
        "INSERT OR IGNORE INTO users (email, pseudo, pwd_hash) VALUES (?, ?, '')"
      ).run(email, pseudo);

      const userRow = db
        .prepare("SELECT id, is2fa FROM users WHERE email = ?")
        .get(email) as { id: number; is2fa: number };

      // Challenge 2FA si activé
      if (userRow.is2fa) {
        const challengeToken = app.jwt.sign(
          { sub: userRow.id, stage: "2fa-challenge" },
          { expiresIn: "10m" }
        );
        return { challengeToken };
      }

      const sessionToken = app.jwt.sign({ sub: userRow.id, email, pseudo });
      return { sessionToken };
    } catch {
      return rep.code(401).send({ error: "Invalid Google token" });
    }
  });

  // ───────────────────────────────────────────────────────────────
  //  AUTH middleware + route protégée
  // ───────────────────────────────────────────────────────────────
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

  // ------------------------------------------------- START
  app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`✅ Server up on http://localhost:${PORT}`);
  });
}

// ──────────────────────────────────────────────────────────────────
main();
