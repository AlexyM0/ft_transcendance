// matches.service.ts
import * as matchesModel from "../models/matches.model";
import * as usersModel from "../models/users.model";
import * as userStatsModel from "../models/user_stats.model";
import { withTx } from "../utils/db";
import { err } from "../utils/errors";

function ensureUserExists(id: number) {
  if (!usersModel.getPublicById(id)) throw err("USER_NOT_FOUND");
}

export function createMatch(meId: number, opponentId: number) {
  if (meId === opponentId) throw err("SAME_PLAYER");
  ensureUserExists(opponentId);
  return matchesModel.createMatch(meId, opponentId);
}

export function getMatch(matchId: number) {
  const row = matchesModel.getMatch(matchId);
  if (!row) throw err("MATCH_NOT_FOUND");
  return row;
}

export function listForUser(userId: number, limit = 50, offset = 0) {
  return matchesModel.listUserMatches(userId, limit, offset);
}

export function recordResult(meId: number, matchId: number, scoreP1: number, scoreP2: number) {
  const match = matchesModel.getMatch(matchId);
  if (!match) throw err("MATCH_NOT_FOUND");

  if (meId !== match.player1_id && meId !== match.player2_id) throw err("FORBIDDEN");

  if (![scoreP1, scoreP2].every((n) => Number.isInteger(n) && n >= 0)) throw err("BAD_SCORES");
  if (scoreP1 === scoreP2) throw err("DRAW_NOT_ALLOWED");

  const winnerId = scoreP1 > scoreP2 ? match.player1_id : match.player2_id;

  return withTx(() => {
    const updated = matchesModel.recordResult(matchId, winnerId, scoreP1, scoreP2);
    if (!updated) throw err("NOT_PENDING");

    const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;
    const winnerScore = winnerId === match.player1_id ? scoreP1 : scoreP2;
    const loserScore = winnerId === match.player1_id ? scoreP2 : scoreP1;

    userStatsModel.applyMatchResultDelta({
      winnerId,
      loserId,
      winnerScore,
      loserScore,
    });
    return updated;
  });
}

export function cancelMatch(meId: number, matchId: number) {
  const match = matchesModel.getMatch(matchId);
  if (!match) throw err("MATCH_NOT_FOUND");
  if (meId !== match.player1_id && meId !== match.player2_id) throw err("FORBIDDEN");

  const updated = matchesModel.cancelMatch(matchId);
  if (!updated) throw err("NOT_PENDING");
  return updated;
}
