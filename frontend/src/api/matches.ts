// src/api/matches.ts
import { getRequest, postRequest, putRequest } from "./http";
import type { Match } from "./types";

export const MatchesAPI = {
  /**
   * POST /api/matches (body: { opponentId }) -> Match
   */
  create: (opponentId: number) => {
    return postRequest<Match>("/api/matches", { opponentId });
  },

  /**
   * GET /api/matches/:matchId -> Match
   */
  get: (matchId: number) => {
    return getRequest<Match>(`/api/matches/${matchId}`);
  },

  /**
   * PUT /api/matches/:matchId/result (body: { scoreP1, scoreP2 }) -> Match
   */
  recordResult: (matchId: number, scoreP1: number, scoreP2: number) => {
    return putRequest<Match>(`/api/matches/${matchId}`, { scoreP1, scoreP2 });
  },

  /**
   * PUT /api/matches/:matchId/cancel -> Match
   */
  cancel: (matchId: number) => {
    return putRequest<Match>(`/api/matches/${matchId}/cancel`);
  },
};
