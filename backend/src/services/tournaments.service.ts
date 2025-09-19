// tournaments.service.ts
import * as tournamentsModel from "../models/tournaments.model";
import * as usersModel from "../models/users.model";
import { err } from "../utils/errors";
import { withTx } from "../utils/db";
import type { TournamentLite, TournamentFull, CreateTournamentPayload, UpdateAliasPayload, TournamentStatus } from "../types/state_types";

// Round-robin generator using player indices
function draftRoundRobin(indices: number[]): Array<[number, number]> {
  const n = indices.length;
  if (n < 2) return [];
  const isOdd = n % 2 === 1;
  const arr = indices.slice();
  if (isOdd) arr.push(-1);
  const rounds = arr.length - 1;
  const pairs: Array<[number, number]> = [];

  let a = arr.slice();
  for (let r = 0; r < rounds; r++) {
    const half = a.length / 2;
    for (let i = 0; i < half; i++) {
      const p1 = a[i],
        p2 = a[a.length - 1 - i];
      if (p1 !== -1 && p2 !== -1) pairs.push([p1!, p2!]);
    }
    const fixed = a[0];
    const tail = a.slice(1);
    tail.unshift(tail.pop()!);
    a = [fixed!, ...tail];
  }
  return pairs;
}

export function listActiveTournaments(q: string, status: string, limit: number, offset: number): TournamentLite[] {
  return tournamentsModel.listActiveTournamentsModel(q ?? "", status ?? "active", limit ?? 50, offset ?? 0);
}

export function createTournament(ownerId: number, payload: CreateTournamentPayload): TournamentFull {
  const title = payload.name.trim() || "Untitled";
  const maxPlayers = Math.max(2, Math.min(64, payload.maxPlayers));
  const tid = withTx(() => tournamentsModel.insertTournament(ownerId, title, maxPlayers, payload.settings));
  const full = tournamentsModel.getTournamentFullModel(tid);

  if (!full) throw err("TOURNAMENT_NOT_FOUND");
  return full;
}

export function getTournament(tournamentId: number): TournamentFull {
  const full = tournamentsModel.getTournamentFullModel(tournamentId);
  if (!full) throw err("TOURNAMENT_NOT_FOUND");
  return full;
}

export function joinTournament(tournamentId: number, userId: number): TournamentFull {
  return withTx(() => {
    const t = tournamentsModel.getTournamentRow(tournamentId);
    if (!t) throw err("TOURNAMENT_NOT_FOUND");
    if (t.status !== "registration") throw err("TOURNAMENT_NOT_IN_REGISTRATION");
    if (tournamentsModel.isParticipant(tournamentId, userId)) return tournamentsModel.getTournamentFullModel(tournamentId)!;

    const count = tournamentsModel.countPlayers(tournamentId);
    if (count >= t.max_players) throw err("TOURNAMENT_FULL");

    const u = tournamentsModel.getOwnerUser(userId); // reuse mapper to fetch {id,pseudo,...}
    const idx = tournamentsModel.nextPlayerIndex(tournamentId);
    tournamentsModel.insertPlayer(tournamentId, idx, userId, u.pseudo, null);

    return tournamentsModel.getTournamentFullModel(tournamentId)!;
  });
}

export function leaveTournament(tournamentId: number, userId: number): TournamentFull {
  return withTx(() => {
    const t = tournamentsModel.getTournamentRow(tournamentId);
    if (!t) throw err("TOURNAMENT_NOT_FOUND");
    if (t.status !== "registration") throw err("TOURNAMENT_NOT_IN_REGISTRATION");
    tournamentsModel.deletePlayer(tournamentId, userId);
    return tournamentsModel.getTournamentFullModel(tournamentId)!;
  });
}

export function updateAlias(tournamentId: number, userId: number, payload: UpdateAliasPayload): TournamentFull {
  return withTx(() => {
    const t = tournamentsModel.getTournamentRow(tournamentId);
    if (!t) throw err("TOURNAMENT_NOT_FOUND");
    const full = tournamentsModel.getTournamentFullModel(tournamentId)!;

    const target = full.players[payload.index];
    if (!target) throw err("BAD_USER_ID");

    const isOwner = userId === t.owner_id;
    const isSelf = userId === target.user_id;
    if (!isOwner && !isSelf) throw err("FORBIDDEN");

    tournamentsModel.updateAliasByIndex(tournamentId, payload.index, payload.alias ?? (null as any));
    return tournamentsModel.getTournamentFullModel(tournamentId)!;
  });
}

export function startTournament(tournamentId: number, userId: number): TournamentFull {
  return withTx(() => {
    const t = tournamentsModel.getTournamentRow(tournamentId);
    if (!t) throw err("TOURNAMENT_NOT_FOUND");
    if (t.owner_id !== userId) throw err("FORBIDDEN");
    if (t.status !== "registration") throw err("TOURNAMENT_NOT_IN_REGISTRATION");

    const n = tournamentsModel.countPlayers(tournamentId);
    if (n < 2) throw err("TOURNAMENT_NOT_FULL");

    // create matches using stable player_idx 0..n-1
    const indices = [...Array(n).keys()];
    const pairs = draftRoundRobin(indices);
    for (const [p1, p2] of pairs) {
      tournamentsModel.insertMatch(tournamentId, p1, p2);
    }
    tournamentsModel.setStatus(tournamentId, "ongoing");
    return tournamentsModel.getTournamentFullModel(tournamentId)!;
  });
}

export function recordMatchResult(matchId: number, scoreP1: number, scoreP2: number, userId: number) {
  return withTx(() => {
    const m = tournamentsModel.getMatch(matchId);
    if (!m) throw err("TOURNAMENT_NOT_FOUND");
    const t = tournamentsModel.getTournamentRow(m.tournament_id);
    if (!t) throw err("TOURNAMENT_NOT_FOUND");
    if (t.status !== "ongoing") throw err("TOURNAMENT_NOT_ONGOING");

    // Policy: any participant may record; you can tighten to owner-only if you like.
    // Quick check: user is any participant in this tournament
    if (!tournamentsModel.isParticipant(m.tournament_id, userId) && userId !== t.owner_id) {
      throw err("FORBIDDEN");
    }

    tournamentsModel.updateMatchScore(matchId, scoreP1, scoreP2);
    return true;
  });
}
