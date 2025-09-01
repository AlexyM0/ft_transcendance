// tournaments.model.ts
import { db } from "../utils/db";

export type TournamentRow = {
  id: number;
  owner_id: number;
  title: string;
  description: string | null;
  max_players: number;
  status: "registration" | "ongoing" | "finished" | "canceled";
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type TournamentMatchRow = {
  id: number;
  tournament_id: number;
  round: number;
  player1_id: number | null;
  player2_id: number | null;
  winner_id: number | null;
  score_p1: number | null;
  score_p2: number | null;
  created_at: string;
};

/**
 * SQL commands
 */
const insertTournament = db.prepare(`
	INSERT INTO tournaments (owner_id, title, description, max_players, status)
	VALUES (?, ?, ?, ?, 'registration')
	RETURNING id, owner_id, title, description, max_players, status, created_at, started_at, ended_at
`);

const selectTournament = db.prepare(`
	SELECT id, owner_id, title, description, max_players, status, created_at, started_at, ended_at
	FROM tournaments
	WHERE id = ?
`);

const listTournamentsQuery = db.prepare(`
	SELECT id, owner_id, title, description, max_players, status, created_at, started_at, ended_at
	FROM tournaments
	ORDER BY created_at DESC
	LIMIT ? OFFSET ?
`);

const insertParticipant = db.prepare(`
	INSERT INTO tournament_participants(tournament_id, user_id)
	VALUES (?, ?)
	ON CONFLICT (tournament_id, user_id) DO NOTHING
`);

const listParticipantsQuery = db.prepare(`
	SELECT user_id FROM tournament_participants WHERE tournament_id = ?
	ORDER BY joined_at ASC
`);

const insertTournamentMatch = db.prepare(`
	INSERT INTO tournament_matches(tournament_id, round, player1_id, player2_id)
	VALUES (?, ?, ?, ?)
	RETURNING id, tournament_id, round, player1_id, player2_id, winner_id, score_p1, score_p2, created_at
`);

const listTournamentMatchesByRoundQuery = db.prepare(`
	SELECT id, tournament_id, round, player1_id, player2_id, winner_id, score_p1, score_p2, created_at
	FROM tournament_matches
	WHERE tournament_id = ? AND round = ?
	ORDER BY id ASC
`);

const getTournamentMatchQuery = db.prepare(`
	SELECT id, tournament_id, round, player1_id, player2_id, winner_id, score_p1, score_p2, created_at
	FROM tournament_matches
	WHERE id = ?
`);

const updateTournamentMatchResult = db.prepare(`
	UPDATE tournament_matches
	SET winner_id = ?, score_p1 = ?, score_p2 = ?
	WHERE id = ? AND winner_id IS NULL
	RETURNING id, tournament_id, round, player1_id, player2_id, winner_id, score_p1, score_p2, created_at
`);

/**
 * API
 */
export function createTournament(ownerId: number, title: string, description: string | null, maxPlayers = 8): TournamentRow {
  return insertTournament.get(ownerId, title, description, maxPlayers) as TournamentRow;
}

export function getTournament(id: number): TournamentRow | undefined {
  return selectTournament.get(id) as TournamentRow | undefined;
}

export function listTournaments(limit = 50, offset = 0): TournamentRow[] {
  return listTournamentsQuery.all(limit, offset) as TournamentRow[];
}

export function addParticipant(tournamentId: number, userId: number) {
  return insertParticipant.run(tournamentId, userId);
}

export function listParticipants(tournamentId: number): Array<{ user_id: number }> {
  return listParticipantsQuery.all(tournamentId) as Array<{ user_id: number }>;
}

export function createTournamentMatch(tournamentId: number, round: number, p1: number | null, p2: number | null): TournamentMatchRow {
  return insertTournamentMatch.get(tournamentId, round, p1, p2) as TournamentMatchRow;
}

export function listTournamentMatchesByRound(tournamentId: number, round: number): TournamentMatchRow[] {
  return listTournamentMatchesByRoundQuery.all(tournamentId, round) as TournamentMatchRow[];
}

export function getTournamentMatch(id: number): TournamentMatchRow | undefined {
  return getTournamentMatchQuery.get(id) as TournamentMatchRow | undefined;
}

export function recordTournamentMatchResult(id: number, winnerId: number, scoreP1: number, scoreP2: number): TournamentMatchRow | undefined {
  return updateTournamentMatchResult.get(winnerId, scoreP1, scoreP2, id) as TournamentMatchRow | undefined;
}
