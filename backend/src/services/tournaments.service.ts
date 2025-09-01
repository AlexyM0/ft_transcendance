// tournaments.service.ts
import * as tournamentsModel from "../models/tournaments.model";
import * as usersModel from "../models/users.model";
import { err } from "../utils/errors";
import { withTx } from "../utils/db";

function ensureUser(userId: number) {
  if (!usersModel.getPublicById(userId)) throw err("USER_NOT_FOUND");
}

export function createTournament(ownerId: number, title: string, description: string | null, maxPlayers = 8) {
  if (typeof title !== "string" || title.trim().length === 0) throw err("BAD_TITLE");
  return tournamentsModel.createTournament(ownerId, title.trim(), description ? String(description) : null, Number(maxPlayers));
}

export function listTournaments(limit = 50, offset = 0) {
  return tournamentsModel.listTournaments(limit, offset);
}

export function getTournamentDetails(tournamentId: number) {
  const tournament = tournamentsModel.getTournament(tournamentId);
  if (!tournament) throw err("TOURNAMENT_NOT_FOUND");
  const participants = tournamentsModel.listParticipants(tournamentId);
  return { tournament: tournament, participants: participants };
}

export function joinTournament(tournamentId: number, userId: number) {
  const tournament = tournamentsModel.getTournament(tournamentId);
  if (!tournament) throw err("TOURNAMENT_NOT_FOUND");

  ensureUser(userId);

  if (tournament.status !== "registration") throw err("NOT_IN_REGISTRATION");
  const participants = tournamentsModel.listParticipants(tournamentId);
  if (participants.length >= tournament.max_players) throw new Error("FULL");

  tournamentsModel.addParticipant(tournamentId, userId);
  return { success: true };
}

export function recordTournamentMatchResult(matchId: number, scoreP1: number, scoreP2: number) {
  if (![scoreP1, scoreP2].every((n) => Number.isInteger(n) && n >= 0)) throw err("BAD_SCORES");

  const tournamentMatch = tournamentsModel.getTournamentMatch(matchId);
  if (!tournamentMatch) throw err("MATCH_NOT_FOUND");

  if (tournamentMatch.player1_id == null || tournamentMatch.player2_id == null) throw err("MATCH_NOT_READY");

  if (scoreP1 === scoreP2) throw err("DRAW_NOT_ALLOWED");
  const winnerId = scoreP1 > scoreP2 ? tournamentMatch.player1_id! : tournamentMatch.player2_id!;

  return withTx(() => {
    const updated = tournamentsModel.recordTournamentMatchResult(matchId, winnerId, scoreP1, scoreP2);
    if (!updated) throw err("ALREADY_REPORTED");
    return updated;
  });
}

export function createMatch(tournamentId: number, round: number, p1: number | null, p2: number | null) {
  return tournamentsModel.createTournamentMatch(tournamentId, round, p1, p2);
}

export function listRound(tournamentId: number, round: number) {
  return tournamentsModel.listTournamentMatchesByRound(tournamentId, round);
}
