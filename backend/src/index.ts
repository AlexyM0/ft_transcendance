import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import multer from "multer";
import { promises as fsPromises } from "fs";

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

	// Migration 003 - Add avatar column to users
	const migrationPath3 = path.join(__dirname, "../migrations/003_add_avatar.sql");
	if (fs.existsSync(migrationPath3)) {
		try {
			db.exec(fs.readFileSync(migrationPath3, "utf8"));
			app.log.info("✅ Migration 003 applied");
		} catch (e) {
			app.log.error("❌ Migration 003 error", e);
		}
	} else {
		app.log.warn("❌ Migration 003 file not found: " + migrationPath3);
	}

	// Migration 004 - Friends system
	const migrationPath4 = path.join(__dirname, "../migrations/004_friends_system.sql");
	if (fs.existsSync(migrationPath4)) {
		try {
			db.exec(fs.readFileSync(migrationPath4, "utf8"));
			app.log.info("✅ Migration 004 applied");
		} catch (e) {
			app.log.error("❌ Migration 004 error", e);
		}
	} else {
		app.log.warn("❌ Migration 004 file not found: " + migrationPath4);
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

	// PUT /api/users/me - Mettre à jour son profil
	app.put("/api/users/me", { preHandler: app.auth }, async (req, rep) => {
		const { pseudo, email } = req.body as {
			pseudo?: string;
			email?: string;
		};

		const user = req.user as { sub: number; pseudo: string; email: string };
		const userId = user.sub;

		// Au moins un champ doit être fourni
		if (!pseudo && !email) {
			return rep.code(400).send({ error: "At least one field (pseudo or email) must be provided" });
		}

		const pseudoNorm = pseudo?.trim();
		const emailNorm = email?.trim().toLowerCase();

		// --- Validation des nouveaux champs ---
		if (pseudoNorm && !USERNAME_REGEX.test(pseudoNorm)) {
			return rep.code(400).send({ error: "Username: 3‑30 letters, numbers, _ or -" });
		}

		if (emailNorm && (!EMAIL_REGEX.test(emailNorm) || emailNorm.length > 254)) {
			return rep.code(400).send({ error: "Invalid email address" });
		}

		// --- Vérifier les doublons (exclure l'utilisateur actuel) ---
		if (pseudoNorm || emailNorm) {
			const conditions = [];
			const params = [];
			
			if (pseudoNorm) {
				conditions.push("pseudo = ?");
				params.push(pseudoNorm);
			}
			if (emailNorm) {
				conditions.push("email = ?");
				params.push(emailNorm);
			}
			params.push(userId); // Pour la condition WHERE id != ?

			const exists = db.prepare(
				`SELECT id FROM users WHERE (${conditions.join(" OR ")}) AND id != ?`
			).get(...params) as { id: number } | undefined;

			if (exists) {
				return rep.code(409).send({ error: "Username or email already in use" });
			}
		}

		// --- Mise à jour des champs ---
		try {
			const updates = [];
			const updateParams = [];

			if (pseudoNorm) {
				updates.push("pseudo = ?");
				updateParams.push(pseudoNorm);
			}
			if (emailNorm) {
				updates.push("email = ?");
				updateParams.push(emailNorm);
			}
			updateParams.push(userId); // Pour la condition WHERE

			const result = db.prepare(
				`UPDATE users SET ${updates.join(", ")} WHERE id = ?`
			).run(...updateParams);

			if (result.changes === 0) {
				return rep.code(404).send({ error: "User not found" });
			}

			// Récupérer les nouvelles données utilisateur
			const updatedUser = db.prepare(
				"SELECT id, pseudo, email, created_at FROM users WHERE id = ?"
			).get(userId) as {
				id: number;
				pseudo: string;
				email: string;
				created_at: string;
			};

			return {
				ok: true,
				message: "Profile updated successfully",
				user: updatedUser
			};

		} catch (err: any) {
			app.log.error("Profile update error", err);
			return rep.code(500).send({ error: "Internal server error" });
		}
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

		// Récupérer les infos utilisateur avec avatar
		const user = db.prepare(
			"SELECT id, pseudo, email, created_at, avatar_url FROM users WHERE id = ?"
		).get(userId) as {
			id: number;
			pseudo: string;
			email: string;
			created_at: string;
			avatar_url: string | null;
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
				created_at: user.created_at,
				avatar_url: user.avatar_url || '/uploads/avatars/default-avatar.png'
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
	 *  MULTER CONFIGURATION - Upload d'avatars
	 * --------------------------------------------------------------*/

// Créer le dossier uploads si il n'existe pas
const uploadsDir = path.join(__dirname, "../uploads/avatars");
await fsPromises.mkdir(uploadsDir, { recursive: true });

// Configuration multer avec types corrects
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, uploadsDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const extension = path.extname(file.originalname);
    const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}${extension}`;
    cb(null, tempFilename);
  }
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 2 * 1024 * 1024 // 2MB max
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Servir les fichiers statiques (avatars)
await app.register(fastifyStatic, {
	  root: path.join(__dirname, "../uploads"),
	  prefix: "/uploads/",
	});

	/* --------------------------------------------------------------
	 *  AVATAR UPLOAD ROUTES
	 * --------------------------------------------------------------*/

// POST /api/users/avatar - Upload d'avatar
app.post("/api/users/avatar", { 
  preHandler: app.auth
}, async (req, rep) => {
  const user = req.user as { sub: number };

  // Wrapper pour multer avec Fastify
  const processUpload = () => new Promise<any>((resolve, reject) => {
    upload.single('avatar')(req as any, rep as any, (err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve((req as any).file);
      }
    });
  });

  try {
    const file = await processUpload();
    
    if (!file) {
      return rep.code(400).send({ error: "No file uploaded" });
    }

    // Supprimer l'ancien avatar si ce n'est pas le default
    const currentUser = db.prepare(
      "SELECT avatar_url FROM users WHERE id = ?"
    ).get(user.sub) as { avatar_url: string | null } | undefined;

    if (currentUser?.avatar_url && 
        !currentUser.avatar_url.includes('default-avatar.png') &&
        currentUser.avatar_url.startsWith('/uploads/avatars/')) {
      
      const oldAvatarPath = path.join(__dirname, "..", currentUser.avatar_url);
      try {
        await fsPromises.unlink(oldAvatarPath);
      } catch (e) {
        app.log.warn("Could not delete old avatar:", e);
      }
    }

    // Renommer le fichier avec l'ID utilisateur
    const extension = path.extname(file.originalname);
    const finalFilename = `user_${user.sub}_${Date.now()}${extension}`;
    const oldPath = file.path;
    const newPath = path.join(uploadsDir, finalFilename);
    
    // Renommer le fichier
    await fsPromises.rename(oldPath, newPath);

    // Sauvegarder le nouveau chemin en DB
    const avatarUrl = `/uploads/avatars/${finalFilename}`;
    
    db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?")
      .run(avatarUrl, user.sub);

    return rep.send({ 
      ok: true, 
      message: "Avatar uploaded successfully",
      avatar_url: avatarUrl 
    });

  } catch (err: any) {
    app.log.error("Avatar upload error", err);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return rep.code(400).send({ error: 'File too large (max 2MB)' });
    }
    
    return rep.code(400).send({ error: err.message || "Upload failed" });
  }
});

// DELETE /api/users/avatar - Supprimer avatar (retour au défaut)
app.delete("/api/users/avatar", { preHandler: app.auth }, async (req, rep) => {
  const user = req.user as { sub: number };

  try {
    const currentUser = db.prepare(
      "SELECT avatar_url FROM users WHERE id = ?"
    ).get(user.sub) as { avatar_url: string | null } | undefined;

    if (currentUser?.avatar_url && 
        !currentUser.avatar_url.includes('default-avatar.png') &&
        currentUser.avatar_url.startsWith('/uploads/avatars/')) {
      
      // Supprimer le fichier
      const avatarPath = path.join(__dirname, "..", currentUser.avatar_url);
      try {
        await fsPromises.unlink(avatarPath);
      } catch (e) {
        app.log.warn("Could not delete avatar file:", e);
      }
    }

    // Remettre l'avatar par défaut
    db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?")
      .run('/uploads/avatars/default-avatar.png', user.sub);

    return { 
      ok: true, 
      message: "Avatar reset to default",
      avatar_url: '/uploads/avatars/default-avatar.png'
    };

  } catch (err: any) {
    app.log.error("Avatar deletion error", err);
    return rep.code(500).send({ error: "Internal server error" });
  }
});

	/* --------------------------------------------------------------
	 *  FRIENDS SYSTEM ROUTES
	 * --------------------------------------------------------------*/
	
	// GET /api/friends - Liste des amis et demandes
	app.get("/api/friends", { preHandler: app.auth }, async (req, rep) => {
		const user = req.user as { sub: number };

		try {
			// Récupérer toutes les relations d'amitié
			const friendsData = db.prepare(`
				SELECT 
					uf.id as friendship_id,
					uf.status,
					uf.created_at,
					CASE 
						WHEN uf.user_id = ? THEN 'sent'     -- J'ai envoyé la demande
						ELSE 'received'                     -- J'ai reçu la demande
					END as direction,
					CASE 
						WHEN uf.user_id = ? THEN u2.id
						ELSE u1.id
					END as friend_id,
					CASE 
						WHEN uf.user_id = ? THEN u2.pseudo
						ELSE u1.pseudo
					END as friend_pseudo,
					CASE 
						WHEN uf.user_id = ? THEN u2.avatar_url
						ELSE u1.avatar_url
					END as friend_avatar
				FROM user_friends uf
				JOIN users u1 ON uf.user_id = u1.id
				JOIN users u2 ON uf.friend_id = u2.id
				WHERE uf.user_id = ? OR uf.friend_id = ?
				ORDER BY uf.created_at DESC
			`).all(user.sub, user.sub, user.sub, user.sub, user.sub, user.sub) as Array<{
				friendship_id: number;
				status: 'pending' | 'accepted' | 'blocked';
				created_at: string;
				direction: 'sent' | 'received';
				friend_id: number;
				friend_pseudo: string;
				friend_avatar: string | null;
			}>;

			// Organiser par catégorie
			const friends = friendsData.filter(f => f.status === 'accepted');
			const sentRequests = friendsData.filter(f => f.status === 'pending' && f.direction === 'sent');
			const receivedRequests = friendsData.filter(f => f.status === 'pending' && f.direction === 'received');

			return {
				friends,
				sent_requests: sentRequests,
				received_requests: receivedRequests,
				stats: {
					total_friends: friends.length,
					pending_sent: sentRequests.length,
					pending_received: receivedRequests.length
				}
			};

		} catch (err: any) {
			app.log.error("Friends list error", err);
			return rep.code(500).send({ error: "Internal server error" });
		}
	});

	// POST /api/friends/:id - Envoyer une demande d'ami
	app.post("/api/friends/:id", { preHandler: app.auth }, async (req, rep) => {
	  const { id } = req.params as { id: string };
	  const user = req.user as { sub: number };
	  const friendId = parseInt(id);

	  if (isNaN(friendId)) {
	    return rep.code(400).send({ error: "Invalid user ID" });
	  }

	  if (user.sub === friendId) {
	    return rep.code(400).send({ error: "Cannot add yourself as friend" });
	  }

	  try {
	    // Vérifier que l'utilisateur cible existe - TYPAGE CORRIGÉ
	    const targetUser = db.prepare("SELECT id, pseudo FROM users WHERE id = ?").get(friendId) as {
	      id: number;
	      pseudo: string;
	    } | undefined;
	    
	    if (!targetUser) {
	      return rep.code(404).send({ error: "User not found" });
	    }

	    // Vérifier qu'il n'y a pas déjà une relation - TYPAGE CORRIGÉ
	    const existingRelation = db.prepare(
	      "SELECT id, status FROM user_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
	    ).get(user.sub, friendId, friendId, user.sub) as {
	      id: number;
	      status: 'pending' | 'accepted' | 'blocked';
	    } | undefined;

	    if (existingRelation) {
	      if (existingRelation.status === 'accepted') {
	        return rep.code(409).send({ error: "Already friends" });
	      } else if (existingRelation.status === 'pending') {
	        return rep.code(409).send({ error: "Friend request already exists" });
	      }
	    }

	    // Créer la demande d'ami
	    db.prepare(
	      "INSERT INTO user_friends (user_id, friend_id, status) VALUES (?, ?, 'pending')"
	    ).run(user.sub, friendId);

	    return rep.code(201).send({ 
	      ok: true, 
	      message: `Friend request sent to ${targetUser.pseudo}` 
	    });

	  } catch (err: any) {
	    app.log.error("Send friend request error", err);
	    return rep.code(500).send({ error: "Internal server error" });
	  }
	});

	// PUT /api/friends/:id/accept - Accepter une demande d'ami - TYPAGE CORRIGÉ
	app.put("/api/friends/:id/accept", { preHandler: app.auth }, async (req, rep) => {
	  const { id } = req.params as { id: string };
	  const user = req.user as { sub: number };
	  const friendId = parseInt(id);

	  if (isNaN(friendId)) {
	    return rep.code(400).send({ error: "Invalid user ID" });
	  }

	  try {
	    // Vérifier qu'il y a une demande pending à accepter - TYPAGE CORRIGÉ
	    const pendingRequest = db.prepare(
	      "SELECT id FROM user_friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'"
	    ).get(friendId, user.sub) as { id: number } | undefined;

	    if (!pendingRequest) {
	      return rep.code(404).send({ error: "No pending friend request found" });
	    }

	    // Accepter la demande
	    const result = db.prepare(
	      "UPDATE user_friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ? AND status = 'pending'"
	    ).run(friendId, user.sub);

	    if (result.changes === 0) {
	      return rep.code(404).send({ error: "Friend request not found" });
	    }

	    return { ok: true, message: "Friend request accepted" };

	  } catch (err: any) {
	    app.log.error("Accept friend request error", err);
	    return rep.code(500).send({ error: "Internal server error" });
	  }
	});

	// DELETE /api/friends/:id - Supprimer ami ou refuser demande
	app.delete("/api/friends/:id", { preHandler: app.auth }, async (req, rep) => {
	  const { id } = req.params as { id: string };
	  const user = req.user as { sub: number };
	  const friendId = parseInt(id);

	  if (isNaN(friendId)) {
	    return rep.code(400).send({ error: "Invalid user ID" });
	  }

	  try {
	    // Supprimer la relation dans les deux sens
	    const result = db.prepare(
	      "DELETE FROM user_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
	    ).run(user.sub, friendId, friendId, user.sub);

	    if (result.changes === 0) {
	      return rep.code(404).send({ error: "Friend relationship not found" });
	    }

	    return { ok: true, message: "Friend removed successfully" };

	  } catch (err: any) {
	    app.log.error("Remove friend error", err);
	    return rep.code(500).send({ error: "Internal server error" });
	  }
	});

	// GET /api/users/search?q=pseudo - Rechercher des utilisateurs - TYPAGE CORRIGÉ
	app.get("/api/users/search", { preHandler: app.auth }, async (req, rep) => {
	  const { q } = req.query as { q?: string };
	  const user = req.user as { sub: number };

	  if (!q || q.trim().length < 2) {
	    return rep.code(400).send({ error: "Search query must be at least 2 characters" });
	  }

	  try {
	    const searchQuery = `%${q.trim()}%`;
	    
	    const users = db.prepare(`
	      SELECT 
	        u.id, 
	        u.pseudo, 
	        u.avatar_url,
	        u.created_at,
	        CASE 
	          WHEN uf.id IS NOT NULL THEN uf.status
	          ELSE NULL
	        END as friendship_status
	      FROM users u
	      LEFT JOIN user_friends uf ON 
	        (uf.user_id = ? AND uf.friend_id = u.id) OR 
	        (uf.user_id = u.id AND uf.friend_id = ?)
	      WHERE u.pseudo LIKE ? 
	        AND u.id != ?
	      ORDER BY u.pseudo ASC
	      LIMIT 20
	    `).all(user.sub, user.sub, searchQuery, user.sub) as Array<{
	      id: number;
	      pseudo: string;
	      avatar_url: string | null;
	      created_at: string;
	      friendship_status: 'pending' | 'accepted' | 'blocked' | null;
	    }>;

	    return { users };

	  } catch (err: any) {
	    app.log.error("User search error", err);
	    return rep.code(500).send({ error: "Internal server error" });
	  }
	});

	/* --------------------------------------------------------------
	 *  SERVER START
	 * --------------------------------------------------------------*/
	app.listen({ port: PORT, host: "0.0.0.0" }, () => {
		console.log(`✅ Server up on http://localhost:${PORT}`);
	});
}

main();
