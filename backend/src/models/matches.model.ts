// matches.model.ts
import { db } from "../utils/db";

export type MatchRow = {
  id: number;
  player1_id: number;
  player2_id: number;
  status: "pending" | "finished" | "canceled";
  winner_id: number | null;
  score_p1: number | null;
  score_p2: number | null;
  created_at: string;
};

/**
 * SQL commands
 */
const insertMatch = db.prepare(`
	INSERT INTO matches (player1_id, player2_id, status)
	VALUES (?, ?, 'pending')
	RETURNING id, player1_id, player2_id, status, winner_id, score_p1, score_p2, created_at
`);

const selectById = db.prepare(`
	SELECT id, player1_id, player2_id, status, winner_id, score_p1, score_p2, created_at
	FROM matches WHERE id = ?
`);

const selectByUser = db.prepare(`
	SELECT id, player1_id, player2_id, status, winner_id, score_p1, score_p2, created_at
	FROM matches
	WHERE player1_id = ? OR player2_id = ?
	ORDER BY created_at DESC
	LIMIT ? OFFSET ?
`);

const updateResult = db.prepare(`
	UPDATE matches
	SET status = 'finished', winner_id = ?, score_p1 = ?, score_p2 = ?
	WHERE id = ? AND status = 'pending'
	RETURNING id, player1_id, player2_id, status, winner_id, score_p1, score_p2, created_at
`);

const cancelMatchQuery = db.prepare(`
	UPDATE matches
	SET status = 'canceled'
	WHERE id = ? AND status = 'pending'
	RETURNING id, player1_id, player2_id, status, winner_id, score_p1, score_p2, created_at
`);

/**
 * API
 */
export function createMatch(p1: number, p2: number): MatchRow {
  if (p1 === p2) throw new Error("players must be different");
  return insertMatch.get(p1, p2) as MatchRow;
}

export function getMatch(id: number): MatchRow | undefined {
  return selectById.get(id) as MatchRow | undefined;
}

export function listUserMatches(userId: number, limit = 50, offset = 0): MatchRow[] {
  return selectByUser.all(userId, userId, limit, offset) as MatchRow[];
}

export function recordResult(id: number, winnerId: number, scoreP1: number, scoreP2: number): MatchRow | undefined {
  return updateResult.get(winnerId, scoreP1, scoreP2, id) as MatchRow | undefined;
}

export function cancelMatch(id: number): MatchRow | undefined {
  return cancelMatchQuery.get(id) as MatchRow | undefined;
}
