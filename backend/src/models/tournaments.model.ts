// tournaments.model.ts
import { db } from "../utils/db";

import type { TournamentStatus, TournamentLite, TournamentFull, PublicUser, TournamentPlayerSlot, TournamentMatch, MatchSettings } from "../types/state_types";

export type TournamentRow = {
  tournament_id: number;
  title: string;
  owner_id: number;
  max_players: number;
  status: TournamentStatus;
  settings_json: string;
  created_at: string;
};

export type TournamentMatchRow = {
  match_id: number;
  tournament_id: number;
  player1_idx: number;
  player2_idx: number;
  played: 0 | 1;
  score_p1: number;
  score_p2: number;
};

const rowToPublicUser = (r: any): PublicUser => ({
  id: r.id,
  pseudo: r.pseudo,
  avatar_url: r.avatar_url ?? null,
});

export function insertTournament(ownerId: number, title: string, maxPlayers: number, settings: MatchSettings): number {
  const stmt = db.prepare(`
    INSERT INTO tournaments (title, owner_id, max_players, status, settings_json)
    VALUES (?, ?, ?, 'registration', ?)
  `);
  const info = stmt.run(title, ownerId, maxPlayers, JSON.stringify(settings));
  return Number(info.lastInsertRowid);
}

export function getTournamentRow(tournamentId: number) {
  return db.prepare(`SELECT * FROM tournaments WHERE tournament_id = ?`).get(tournamentId) as TournamentRow;
}

export function getOwnerUser(owner_id: number): PublicUser {
  const r = db.prepare(`SELECT id, pseudo, avatar_url FROM users WHERE id = ?`).get(owner_id);
  return rowToPublicUser(r);
}

export function listActiveTournamentsModel(q: string, status: string, limit: number, offset: number): TournamentLite[] {
  // status="active" means registration OR ongoing
  const statuses = status === "active" ? ["registration", "ongoing"] : [status];

  const rows = db
    .prepare(
      `
    SELECT t.tournament_id, t.title, t.owner_id, t.max_players, t.status, t.created_at,
           u.id AS creator_id, u.pseudo, u.avatar_url,
           (SELECT COUNT(*) FROM tournament_players p WHERE p.tournament_id = t.tournament_id) AS player_count
    FROM tournaments t
    JOIN users u ON u.id = t.owner_id
    WHERE t.status IN (${statuses.map(() => "?").join(",")})
      AND (LOWER(u.pseudo) LIKE LOWER(?) OR ? = '')
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(...statuses, `%${q}%`, q ? 1 : "", limit, offset);

  return rows.map((r: any) => ({
    tournament_id: r.tournament_id,
    title: r.title,
    created_by: { id: r.creator_id, pseudo: r.pseudo, avatar_url: r.avatar_url },
    max_players: r.max_players,
    player_count: r.player_count,
    status: r.status as TournamentStatus,
    created_at: r.created_at,
  }));
}

export function getTournamentFullModel(tournamentId: number): TournamentFull | null {
  const t = getTournamentRow(tournamentId);

  if (!t) return null;

  const owner = getOwnerUser(t.owner_id);

  const players = db
    .prepare(
      `SELECT user_id, name, alias
     FROM tournament_players
     WHERE tournament_id = ?
     ORDER BY player_idx ASC`
    )
    .all(tournamentId) as TournamentPlayerSlot[];

  const matches = db
    .prepare(
      `SELECT tournament_id, match_id, player1_idx, player2_idx, played, score_p1, score_p2
     FROM tournament_matches
     WHERE tournament_id = ?
     ORDER BY match_id ASC`
    )
    .all(tournamentId) as TournamentMatch[];

  console.log(players);

  const full: TournamentFull = {
    tournament_id: t.tournament_id,
    title: t.title,
    owner,
    max_players: t.max_players,
    status: t.status,
    settings: JSON.parse(t.settings_json),
    players,
    matches,
  };
  return full;
}

export function countPlayers(tournamentId: number): number {
  const r = db.prepare(`SELECT COUNT(*) AS c FROM tournament_players WHERE tournament_id = ?`).get(tournamentId) as { c: number };
  return r?.c ?? 0;
}

export function isParticipant(tournamentId: number, userId: number): boolean {
  const r = db.prepare(`SELECT 1 FROM tournament_players WHERE tournament_id = ? AND user_id = ? LIMIT 1`).get(tournamentId, userId);
  return !!r;
}

export function nextPlayerIndex(tournamentId: number): number {
  const r = db.prepare(`SELECT COALESCE(MAX(player_idx), -1) + 1 AS next_idx FROM tournament_players WHERE tournament_id = ?`).get(tournamentId) as { next_idx: number };
  return r?.next_idx ?? 0;
}

export function insertPlayer(tournamentId: number, player_idx: number, userId: number, name: string, alias: string | null) {
  db.prepare(
    `INSERT INTO tournament_players (tournament_id, player_idx, user_id, name, alias)
     VALUES (?, ?, ?, ?, ?)`
  ).run(tournamentId, player_idx, userId, name, alias);
}

export function deletePlayer(tournamentId: number, userId: number) {
  db.prepare(`DELETE FROM tournament_players WHERE tournament_id = ? AND user_id = ?`).run(tournamentId, userId);
}

export function updateAliasByIndex(tournamentId: number, index: number, alias: string) {
  db.prepare(`UPDATE tournament_players SET alias = ? WHERE tournament_id = ? AND player_idx = ?`).run(alias, tournamentId, index);
}

export function setStatus(tournamentId: number, status: TournamentStatus) {
  db.prepare(`UPDATE tournaments SET status = ? WHERE tournament_id = ?`).run(status, tournamentId);
}

export function insertMatch(tournamentId: number, p1: number, p2: number) {
  db.prepare(
    `INSERT INTO tournament_matches (tournament_id, player1_idx, player2_idx, played)
     VALUES (?, ?, ?, 0)`
  ).run(tournamentId, p1, p2);
}

export function updateMatchScore(matchId: number, scoreP1: number, scoreP2: number) {
  db.prepare(`UPDATE tournament_matches SET played = 1, score_p1 = ?, score_p2 = ? WHERE match_id = ?`).run(scoreP1, scoreP2, matchId);
}

export function getMatch(matchId: number) {
  return db.prepare(`SELECT * FROM tournament_matches WHERE match_id = ?`).get(matchId) as TournamentMatchRow;
}
