// src/store/usersStats.ts
import { createStore } from "./createStore";
import { UsersAPI } from "../api/users";
import type { UserStats } from "../api/types";

export type StatsEntry = {
  loading: boolean;
  data: UserStats | null;
  error: string | null;
};

export type UserStatsState = {
  byId: Record<number, StatsEntry>;
};

export const userStats = createStore<UserStatsState>({
  byId: {},
});

/** Internal: ensure an entry object exists. */
function ensureEntry(st: UserStatsState, userId: number): UserStatsState {
  if (st.byId[userId]) return st;
  return {
    ...st,
    byId: { ...st.byId, [userId]: { loading: false, data: null, error: null } },
  };
}

/** One-shot fetch of stats for a user id. */
export async function loadUserStats(userId: number) {
  // in-flight guard
  const s = userStats.get();
  const entry = s.byId[userId];
  if (entry?.loading) return;

  userStats.set((st) => {
    const base = ensureEntry(st, userId);
    return {
      ...base,
      byId: {
        ...base.byId,
        [userId]: { ...base.byId[userId]!, loading: true, error: null },
      },
    };
  });

  try {
    const data = await UsersAPI.getStats(userId);
    userStats.set((st) => ({
      ...st,
      byId: {
        ...st.byId,
        [userId]: { loading: false, data, error: null },
      },
    }));
    return data;
  } catch (e: any) {
    userStats.set((st) => ({
      ...st,
      byId: {
        ...st.byId,
        [userId]: { loading: false, data: null, error: e?.message ?? "Failed to load stats" },
      },
    }));
    throw e;
  }
}

/** Seed a stats value without fetching (e.g., SSR or batch API). */
export function primeUserStats(userId: number, data: UserStats) {
  userStats.set((st) => ({
    ...ensureEntry(st, userId),
    byId: { ...st.byId, [userId]: { loading: false, data, error: null } },
  }));
}

/** Explicit invalidation (e.g., after recording a match result). */
export function invalidateUserStats(userId: number) {
  userStats.set((st) => ({
    ...ensureEntry(st, userId),
    byId: { ...st.byId, [userId]: { ...st.byId[userId]!, loading: false, error: null, data: null } },
  }));
}

/** Read helpers (sync). */
export function getStats(userId: number): StatsEntry {
  return userStats.get().byId[userId] ?? { loading: false, data: null, error: null };
}
