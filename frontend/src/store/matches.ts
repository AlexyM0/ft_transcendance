// src/store/matches.ts
import { createStore } from "./createStore";
import { MatchesAPI } from "../api/matches";
import type { Match } from "../api/types";

export type MatchesState = {
  byId: Record<number, Match>;
  loading: Record<number, boolean>;
  creating: boolean;
  error: string | null;
};

export const matches = createStore<MatchesState>({
  byId: {},
  loading: {},
  creating: false,
  error: null,
});

export async function createMatch(opponentId: number) {
  matches.set((s) => ({ ...s, creating: true, error: null }));
  try {
    const match = await MatchesAPI.create(opponentId);
    matches.set((s) => ({ ...s, byId: { ...s.byId, [match.id]: match }, creating: false }));
    return match;
  } catch (e: any) {
    matches.set((s) => ({ ...s, creating: false, error: e?.message ?? "Failed to create match" }));
    throw e;
  }
}

export async function loadMatch(matchId: number) {
  matches.set((s) => ({ ...s, loading: { ...s.loading, [matchId]: true } }));
  try {
    const match = await MatchesAPI.get(matchId);
    matches.set((s) => ({ ...s, byId: { ...s.byId, [matchId]: match }, loading: { ...s.loading, [matchId]: false } }));
  } catch {
    matches.set((s) => ({ ...s, loading: { ...s.loading, [matchId]: false } }));
  }
}

export async function recordResult(matchId: number, scoreP1: number, scoreP2: number) {
  const match = await MatchesAPI.recordResult(matchId, scoreP1, scoreP2);
  matches.set((s) => ({ ...s, byId: { ...s.byId, [matchId]: match } }));
  return match;
}

export async function cancelMatch(matchId: number) {
  const match = await MatchesAPI.cancel(matchId);
  matches.set((s) => ({ ...s, byId: { ...s.byId, [matchId]: match } }));
  return match;
}
