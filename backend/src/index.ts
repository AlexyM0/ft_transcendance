import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = fastify({ logger: true });
  const PORT = 8000;

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

  // Migration 001 - Create users
  const migrationPath1 = path.join(
    __dirname,
    "../migrations/001_create_users.sql"
  );
  if (fs.existsSync(migrationPath1)) {
    try {
      db.exec(fs.readFileSync(migrationPath1, "utf8"));
      app.log.info("✅ Migration 001 applied");
    } catch (e) {
      app.log.error("❌ Migration 001 error", e);
    }
  } else {
    app.log.warn("❌ Migration 001 file not found: " + migrationPath1);
  }

  // Migration 002 - Create stats and tournaments
  const migrationPath2 = path.join(
    __dirname,
    "../migrations/002_create_stats_and_tournaments.sql"
  );
  if (fs.existsSync(migrationPath2)) {
    try {
      db.exec(fs.readFileSync(migrationPath2, "utf8"));
      app.log.info("✅ Migration 002 applied");
    } catch (e) {
      app.log.error("❌ Migration 002 error", e);
    }
  } else {
    app.log.warn("❌ Migration 002 file not found: " + migrationPath2);
  }

  /* --------------------------------------------------------------
   *  VALIDATION CONSTANTS
   * --------------------------------------------------------------*/
  const USERNAME_REGEX = /^[A-Za-z0-9_-]{3,30}$/; // 3‑30 chars, alphanum + _ -
  const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i; // simple but solid
  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,128}$/; // 6‑128, strength

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
    const emailNorm = email?.trim().toLowerCase();

    // --- Validation ---
    if (!USERNAME_REGEX.test(pseudoNorm || "")) {
      return rep
        .code(400)
        .send({ error: "Username: 3‑30 letters, numbers, _ or -" });
    }
    if (!PASSWORD_REGEX.test(password || "")) {
      return rep.code(400).send({
        error: "Password 6‑128 chars, with upper, lower and digit",
      });
    }
    if (!EMAIL_REGEX.test(emailNorm || "") || emailNorm.length > 254) {
      return rep.code(400).send({ error: "Invalid email address" });
    }

    // --- Duplicate check (graceful) ---
    const exists = db
      .prepare("SELECT id FROM users WHERE email = ? OR pseudo = ?")
      .get(emailNorm, pseudoNorm) as { id: number } | undefined;
    if (exists) {
      return rep
        .code(409)
        .send({ error: "Email or username already in use" });
    }

    const hash = await bcrypt.hash(password, 10);

    try {
      db.prepare(
        "INSERT INTO users (email, pwd_hash, pseudo) VALUES (?, ?, ?)"
      ).run(emailNorm, hash, pseudoNorm);

      return rep.code(201).send({ ok: true });
    } catch (err: any) {
      app.log.error("Registration error", err);
      return rep.code(500).send({ error: "Internal server error" });
    }
  });

  /* --------------------------------------------------------------
   *  LOGIN
   * --------------------------------------------------------------*/
  app.post("/api/login", async (req, rep) => {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    const emailNorm = email.trim().toLowerCase();

    const row = db.prepare(
      "SELECT id, pwd_hash, pseudo FROM users WHERE email = ?"
    ).get(emailNorm) as | {
      id: number;
      pwd_hash: string;
      pseudo: string;
    } | undefined;

    if (!row || !(await bcrypt.compare(password, row.pwd_hash))) {
      return rep.code(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({ sub: row.id, email: emailNorm, pseudo: row.pseudo });
    return { token };
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
   *  PROFIL & STATISTIQUES ROUTES
   * --------------------------------------------------------------*/
  
  // GET /api/users/:id/profile - Profil utilisateur avec stats
  app.get("/api/users/:id/profile", { preHandler: app.auth }, async (req, rep) => {
    const { id } = req.params as { id: string };
    const userId = parseInt(id);
    
    if (isNaN(userId)) {
      return rep.code(400).send({ error: "Invalid user ID" });
    }

    // Récupérer les infos utilisateur
    const user = db.prepare(
      "SELECT id, pseudo, email, created_at FROM users WHERE id = ?"
    ).get(userId) as {
      id: number;
      pseudo: string;
      email: string;
      created_at: string;
    } | undefined;

    if (!user) {
      return rep.code(404).send({ error: "User not found" });
    }

    // Récupérer les stats (créer si n'existent pas)
    let stats = db.prepare(
      "SELECT * FROM user_stats WHERE user_id = ?"
    ).get(userId) as any;

    if (!stats) {
      // Créer les stats si elles n'existent pas
      db.prepare(
        "INSERT INTO user_stats (user_id) VALUES (?)"
      ).run(userId);
      
      stats = db.prepare(
        "SELECT * FROM user_stats WHERE user_id = ?"
      ).get(userId);
    }

    return {
      user: {
        id: user.id,
        pseudo: user.pseudo,
        email: user.email,
        created_at: user.created_at
      },
      stats: {
        wins: stats.wins,
        losses: stats.losses,
        games_played: stats.games_played,
        win_ratio: stats.win_ratio,
        total_score: stats.total_score,
        best_score: stats.best_score
      }
    };
  });

  // GET /api/users/:id/matches - Historique des matchs
  app.get("/api/users/:id/matches", { preHandler: app.auth }, async (req, rep) => {
    const { id } = req.params as { id: string };
    const userId = parseInt(id);
    
    if (isNaN(userId)) {
      return rep.code(400).send({ error: "Invalid user ID" });
    }

    const matches = db.prepare(`
      SELECT 
        m.*,
        p1.pseudo as player1_pseudo,
        p2.pseudo as player2_pseudo,
        w.pseudo as winner_pseudo
      FROM match_history m
      LEFT JOIN users p1 ON m.player1_id = p1.id
      LEFT JOIN users p2 ON m.player2_id = p2.id
      LEFT JOIN users w ON m.winner_id = w.id
      WHERE m.player1_id = ? OR m.player2_id = ?
      ORDER BY m.match_date DESC
      LIMIT 20
    `).all(userId, userId);

    return { matches };
  });

  // POST /api/matches - Enregistrer un match
  app.post("/api/matches", { preHandler: app.auth }, async (req, rep) => {
    const { player1_id, player2_id, player1_score, player2_score, match_type } = req.body as {
      player1_id: number;
      player2_id: number;
      player1_score: number;
      player2_score: number;
      match_type?: string;
    };

    // Validation
    if (!player1_id || !player2_id || player1_score < 0 || player2_score < 0) {
      return rep.code(400).send({ error: "Invalid match data" });
    }

    if (player1_id === player2_id) {
      return rep.code(400).send({ error: "Players cannot be the same" });
    }

    // Déterminer le gagnant
    const winner_id = player1_score > player2_score ? player1_id : 
                     player2_score > player1_score ? player2_id : null;

    try {
      // Enregistrer le match
      const matchResult = db.prepare(`
        INSERT INTO match_history 
        (player1_id, player2_id, winner_id, player1_score, player2_score, match_type, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(player1_id, player2_id, winner_id, player1_score, player2_score, match_type || '1v1', 0);

      // Mettre à jour les stats des joueurs
      const updateStats = (playerId: number, isWinner: boolean, score: number) => {
        const currentStats = db.prepare(
          "SELECT * FROM user_stats WHERE user_id = ?"
        ).get(playerId);

        if (!currentStats) {
          // Créer les stats si elles n'existent pas
          db.prepare(
            "INSERT INTO user_stats (user_id, wins, losses, games_played, total_score, best_score) VALUES (?, ?, ?, ?, ?, ?)"
          ).run(playerId, isWinner ? 1 : 0, isWinner ? 0 : 1, 1, score, score);
        } else {
          // Mettre à jour les stats existantes
          db.prepare(`
            UPDATE user_stats 
            SET wins = wins + ?, 
                losses = losses + ?, 
                games_played = games_played + 1, 
                total_score = total_score + ?,
                best_score = CASE WHEN ? > best_score THEN ? ELSE best_score END
            WHERE user_id = ?
          `).run(
            isWinner ? 1 : 0, 
            isWinner ? 0 : 1, 
            score, 
            score, 
            score, 
            playerId
          );
        }
      };

      // Mettre à jour les stats des deux joueurs
      updateStats(player1_id, winner_id === player1_id, player1_score);
      updateStats(player2_id, winner_id === player2_id, player2_score);

      return rep.code(201).send({ 
        ok: true, 
        match_id: matchResult.lastInsertRowid 
      });

    } catch (err: any) {
      app.log.error("Match recording error", err);
      return rep.code(500).send({ error: "Internal server error" });
    }
  });

  /* --------------------------------------------------------------
   *  TOURNOIS ROUTES
   * --------------------------------------------------------------*/
  
  // GET /api/tournaments - Lister les tournois
  app.get("/api/tournaments", { preHandler: app.auth }, async (req, rep) => {
    const tournaments = db.prepare(`
      SELECT 
        t.*,
        u.pseudo as creator_pseudo,
        w.pseudo as winner_pseudo
      FROM tournaments t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users w ON t.winner_id = w.id
      ORDER BY t.created_at DESC
      LIMIT 20
    `).all();

    return { tournaments };
  });

  // POST /api/tournaments - Créer un tournoi
  app.post("/api/tournaments", { preHandler: app.auth }, async (req, rep) => {
    const { name, description, max_players } = req.body as {
      name: string;
      description?: string;
      max_players?: number;
    };

    const user = req.user as { sub: number };
    
    // Validation
    if (!name || name.trim().length < 3) {
      return rep.code(400).send({ error: "Tournament name must be at least 3 characters" });
    }

    const maxPlayers = max_players && max_players >= 4 && max_players <= 16 ? max_players : 8;

    try {
      const result = db.prepare(`
        INSERT INTO tournaments (name, description, max_players, created_by)
        VALUES (?, ?, ?, ?)
      `).run(name.trim(), description || '', maxPlayers, user.sub);

      return rep.code(201).send({ 
        ok: true, 
        tournament_id: result.lastInsertRowid 
      });

    } catch (err: any) {
      app.log.error("Tournament creation error", err);
      return rep.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /api/tournaments/:id - Détails d'un tournoi
  app.get("/api/tournaments/:id", { preHandler: app.auth }, async (req, rep) => {
    const { id } = req.params as { id: string };
    const tournamentId = parseInt(id);
    
    if (isNaN(tournamentId)) {
      return rep.code(400).send({ error: "Invalid tournament ID" });
    }

    const tournament = db.prepare(`
      SELECT 
        t.*,
        u.pseudo as creator_pseudo,
        w.pseudo as winner_pseudo
      FROM tournaments t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users w ON t.winner_id = w.id
      WHERE t.id = ?
    `).get(tournamentId);

    if (!tournament) {
      return rep.code(404).send({ error: "Tournament not found" });
    }

    // Récupérer les matchs du tournoi
    const matches = db.prepare(`
      SELECT 
        m.*,
        p1.pseudo as player1_pseudo,
        p2.pseudo as player2_pseudo,
        w.pseudo as winner_pseudo
      FROM match_history m
      LEFT JOIN users p1 ON m.player1_id = p1.id
      LEFT JOIN users p2 ON m.player2_id = p2.id
      LEFT JOIN users w ON m.winner_id = w.id
      WHERE m.tournament_id = ?
      ORDER BY m.match_date ASC
    `).all(tournamentId);

    return { tournament, matches };
  });

  /* --------------------------------------------------------------
   *  SERVER START
   * --------------------------------------------------------------*/
  app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`✅ Server up on http://localhost:${PORT}`);
  });
}

main();
