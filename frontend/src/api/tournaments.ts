// src/api/tournaments.ts
import { getRequest, postRequest, putRequest } from "./http";
import type { Tournament, TournamentDetails } from "./types";

export const TournamentsAPI = {
  /**
   * GET /api/tournaments?limit&offset -> { tournaments, limit, offset }
   */
  listTournaments: (limit = 50, offset = 0) => {
    return getRequest<{ tournaments: Tournament[]; limit: number; offset: number }>("/api/tournaments", { limit, offset });
  },

  /**
   * POST /api/tournaments -> Tournament
   */
  createTournament: (title: string, description: string | null = null, maxPlayers = 8) => {
    return postRequest<Tournament>("/api/tournaments", { title, description, maxPlayers });
  },

  /**
   * GET /api/tournaments/:tournamentId -> Tournament Details
   */
  getDetails: (tournamentId: number) => {
    return getRequest<TournamentDetails>(`/api/tournaments/${tournamentId}`);
  },

  /**
   * POST /api/tournaments/:tournamentId/join -> { success: true}
   */
  joinTournament: (tournamentId: number) => {
    return postRequest<{ success: true }>(`/api/tournaments/${tournamentId}/join`);
  },

  /**
   * PUT /api/tournaments/:matchId/result (body: { scoreP1, scoreP2 }) -> updated match (backend returns "updated")
   */
  recordMatchResult: (matchId: number, scoreP1: number, scoreP2: number) => {
    return putRequest<any>(`/api/tournaments/${matchId}/result`, { scoreP1, scoreP2 });
  },
};
