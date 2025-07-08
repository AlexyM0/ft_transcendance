import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";

export const authRoutes = async (app: FastifyInstance) => {
  const db = app.db;

  app.post("/api/register", async (req, rep) => {
    const { pseudo, email, password } = req.body as any;

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
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return rep.code(409).send({ error: "email ou pseudo déjà utilisé" });
      }
      return rep.code(500).send({ error: "Erreur interne" });
    }
  });

  app.post("/api/login", async (req, rep) => {
    const { email, password } = req.body as any;
    const user = db
      .prepare("SELECT id, pwd_hash, pseudo FROM users WHERE email = ?")
      .get(email.toLowerCase());

    if (!user || !(await bcrypt.compare(password, user.pwd_hash))) {
      return rep.code(401).send({ error: "mauvais identifiants" });
    }

    const token = app.jwt.sign({ sub: user.id, email, pseudo: user.pseudo });
    return { token };
  });
};
