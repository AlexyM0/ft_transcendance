// matches.model.ts
import { db } from "../utils/db";

export type MatchRowSql = {
  id: number;
  p1_id: number;
  p1_pseudo: string;
  p1_avatar_url: string | null;
  p2_id: number;
  p2_pseudo: string;
  p2_avatar_url: string | null;
  status: "pending" | "finished" | "canceled";
  winner_id: number | null;
  score_p1: number | null;
  score_p2: number | null;
  created_at: string; // stored as TEXT (UTC)
};

/* ---------- Prepared statements ---------- */

// Detailed-by-id (joined)
const selectDetailedById = db.prepare(`
  SELECT
    m.id,
    u1.id         AS p1_id, u1.pseudo AS p1_pseudo, u1.avatar_url AS p1_avatar_url,
    u2.id         AS p2_id, u2.pseudo AS p2_pseudo, u2.avatar_url AS p2_avatar_url,
    m.status, m.winner_id, m.score_p1, m.score_p2, m.created_at
  FROM matches m
  JOIN users u1 ON u1.id = m.player1_id
  JOIN users u2 ON u2.id = m.player2_id
  WHERE m.id = ?
`);

// List for a user (joined)
const selectByUserDetails = db.prepare(`
  SELECT
    m.id,
    u1.id         AS p1_id, u1.pseudo AS p1_pseudo, u1.avatar_url AS p1_avatar_url,
    u2.id         AS p2_id, u2.pseudo AS p2_pseudo, u2.avatar_url AS p2_avatar_url,
    m.status, m.winner_id, m.score_p1, m.score_p2, m.created_at
  FROM matches m
  JOIN users u1 ON u1.id = m.player1_id
  JOIN users u2 ON u2.id = m.player2_id
  WHERE m.player1_id = ? OR m.player2_id = ?
  ORDER BY m.created_at DESC
  LIMIT ? OFFSET ?
`);

// Bare mutations (no joins in RETURNING)
const insertMatch = db.prepare(`
  INSERT INTO matches (player1_id, player2_id, status)
  VALUES (?, ?, 'pending')
`);

const updateResult = db.prepare(`
  UPDATE matches
  SET status = 'finished', winner_id = ?, score_p1 = ?, score_p2 = ?
  WHERE id = ? AND status = 'pending'
`);

const cancelMatchStmt = db.prepare(`
  UPDATE matches
  SET status = 'canceled'
  WHERE id = ? AND status = 'pending'
`);

// Optional: list all (joined)
const selectAllMatches = db.prepare(`
  SELECT
    m.id,
    u1.id         AS p1_id, u1.pseudo AS p1_pseudo, u1.avatar_url AS p1_avatar_url,
    u2.id         AS p2_id, u2.pseudo AS p2_pseudo, u2.avatar_url AS p2_avatar_url,
    m.status, m.winner_id, m.score_p1, m.score_p2, m.created_at
  FROM matches m
  JOIN users u1 ON u1.id = m.player1_id
  JOIN users u2 ON u2.id = m.player2_id
`);

/* ---------- API ---------- */

export function createMatch(p1: number, p2: number): MatchRowSql {
  if (p1 === p2) throw new Error("players must be different");
  const tx = db.transaction((p1: number, p2: number) => {
    const info = insertMatch.run(p1, p2);
    const id = Number(info.lastInsertRowid);
    return selectDetailedById.get(id) as MatchRowSql;
  });
  return tx(p1, p2);
}

export function getMatch(id: number): MatchRowSql | undefined {
  return selectDetailedById.get(id) as MatchRowSql | undefined;
}

export function listUserMatches(userId: number, limit = 50, offset = 0): MatchRowSql[] {
  // Bind userId twice to match the WHERE clause
  return selectByUserDetails.all(userId, userId, limit, offset) as MatchRowSql[];
}

export function recordResult(id: number, winnerId: number, scoreP1: number, scoreP2: number): MatchRowSql | undefined {
  const tx = db.transaction((id: number, winnerId: number, s1: number, s2: number) => {
    const res = updateResult.run(winnerId, s1, s2, id);
    if (res.changes !== 1) return undefined;
    return selectDetailedById.get(id) as MatchRowSql;
  });
  return tx(id, winnerId, scoreP1, scoreP2);
}

export function cancelMatch(id: number): MatchRowSql | undefined {
  const tx = db.transaction((id: number) => {
    const res = cancelMatchStmt.run(id);
    if (res.changes !== 1) return undefined;
    return selectDetailedById.get(id) as MatchRowSql;
  });
  return tx(id);
}

export function listAllMatches(): MatchRowSql[] {
  return selectAllMatches.all() as MatchRowSql[];
}
