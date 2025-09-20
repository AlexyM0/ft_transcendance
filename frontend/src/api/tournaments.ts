// src/api/tournaments.ts
import { deleteRequest, getRequest, postRequest, putRequest } from "./http";
import type {
  TournamentLite,
  TournamentFull,
  CreateTournamentPayload,
  UpdateAliasPayload,
} from "./types";

export const TournamentsAPI = {
  /**
   * GET /api/tournaments?limit&offset -> { tournaments, limit, offset }
   */
  listActiveTournaments: (
    query: string,
    status = "active",
    limit = 50,
    offset = 0
  ) => {
    return getRequest<TournamentLite[]>("/tournaments", {
      q: query,
      status,
      limit,
      offset,
    });
  },

  /**
   * POST /api/tournaments -> Tournament
   */
  createTournament: (payload: CreateTournamentPayload) => {
    return postRequest<TournamentFull>("/tournaments", payload);
  },

  /**
   * GET /api/tournaments/:tournamentId -> Tournament Details
   */
  getTournament: (tournamentId: number) => {
    return getRequest<TournamentFull>(`/tournaments/${tournamentId}`);
  },

  /**
   * POST /api/tournaments/:tournamentId/join -> { success: true}
   */
  joinTournament: (tournamentId: number) => {
    return postRequest<TournamentFull>(`/tournaments/${tournamentId}/join`);
  },

  /**
   *
   * POST /api/tournaments/:tournamentId/leave -> { success: true }
   */
  leaveTournament: (tournamentId: number) => {
    return postRequest<TournamentFull>(`/tournaments/${tournamentId}/leave`);
  },

  /**
   * PUT /api/tournaments/:tournamentId/alias
   */
  updateAlias: (tournamentId: number, payload: UpdateAliasPayload) => {
    return putRequest<TournamentFull>(
      `/tournaments/${tournamentId}/alias`,
      payload
    );
  },

  /**
   * POST /api/tournaments/:tournamentId/start
   */
  startTournament: (tournamentId: number) => {
    return postRequest<TournamentFull>(`/tournaments/${tournamentId}/start`);
  },

  /**
   * DELETE /api/tournaments/:tournamentId
   */
  cancelTournament: (tournamentId: number) => {
    return deleteRequest<{ deleted: true }>(`/tournaments/${tournamentId}`);
  },

  /**
   * PUT /api/tournaments/:matchId/result (body: { scoreP1, scoreP2 }) -> updated match (backend returns "updated")
   */
  recordMatchResult: (matchId: number, scoreP1: number, scoreP2: number) => {
    return putRequest<any>(`/tournaments/${matchId}/result`, {
      scoreP1,
      scoreP2,
    });
  },
};
