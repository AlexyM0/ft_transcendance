// src/store/tournaments.ts
import { createStore } from "./createStore";
import { TournamentsAPI } from "../api/tournaments";
import type { Tournament, TournamentDetails } from "../api/types";

export type TournamentsState = {
  listing: {
    loading: boolean;
    items: Tournament[];
    limit: number;
    offset: number;
    error: string | null;
  };
  byId: Record<number, TournamentDetails>;
  loadingDetails: Record<number, boolean>;
  creating: boolean;
};

export const tournaments = createStore<TournamentsState>({
  listing: {
    loading: false,
    items: [],
    limit: 50,
    offset: 0,
    error: null,
  },
  byId: {},
  loadingDetails: {},
  creating: false,
});

export async function listTournaments(limit = 50, offset = 0) {
  tournaments.set((s) => ({
    ...s,
    listing: {
      ...s.listing,
      loading: true,
      error: null,
    },
  }));

  try {
    const res = await TournamentsAPI.listTournaments(limit, offset);
    tournaments.set((s) => ({
      ...s,
      listing: {
        ...s.listing,
        loading: false,
        items: res.tournaments,
        limit: res.limit,
        offset: res.offset,
      },
    }));
  } catch (e: any) {
    tournaments.set((s) => ({
      ...s,
      listing: {
        ...s.listing,
        loading: false,
        error: e?.message ?? "Failed to load tournaments",
      },
    }));
  }
}

export async function createTournament(title: string, description: string | null, maxPlayers = 8) {
  tournaments.set((s) => ({
    ...s,
    creating: true,
  }));

  try {
    const tournament = await TournamentsAPI.createTournament(title, description, maxPlayers);
    tournaments.set((s) => ({
      ...s,
      creating: false,
      listing: {
        ...s.listing,
        items: [tournament, ...s.listing.items],
      },
    }));
    return tournament;
  } finally {
    tournaments.set((s) => ({
      ...s,
      creating: false,
    }));
  }
}

export async function loadTournamentDetails(tournamentId: number) {
  tournaments.set((s) => ({
    ...s,
    loadingDetails: { ...s.loadingDetails, [tournamentId]: true },
  }));

  try {
    const details = await TournamentsAPI.getDetails(tournamentId);
    tournaments.set((s) => ({
      ...s,
      byId: {
        ...s.byId,
        [tournamentId]: details,
      },
      loadingDetails: {
        ...s.loadingDetails,
        [tournamentId]: false,
      },
    }));
  } catch {
    tournaments.set((s) => ({
      ...s,
      loadingDetails: {
        ...s.loadingDetails,
        [tournamentId]: false,
      },
    }));
  }
}

export async function joinTournament(tournamentId: number) {
  await TournamentsAPI.joinTournament(tournamentId);
  // Refresh details so participants list is up to date
  await loadTournamentDetails(tournamentId);
}

export async function recordTournamentMatchResult(matchId: number, scoreP1: number, scoreP2: number) {
  return await TournamentsAPI.recordMatchResult(matchId, scoreP1, scoreP2);
}
