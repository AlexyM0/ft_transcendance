// src/store/usersIndex.ts
import { createStore } from "./createStore";
import { UsersAPI } from "../api/users";
import type { PublicUser } from "../api/types";

export type UsersIndexState = {
  byId: Record<number, PublicUser>;
  loading: Record<number, boolean>;
  updating: Record<number, boolean>;
  error: Record<number, string | null>;
};

export const usersIndex = createStore<UsersIndexState>({
  byId: {},
  loading: {},
  updating: {},
  error: {},
});

/** Merge/prime a single user into the cache */
export function primeUser(user: PublicUser) {
  usersIndex.set((s) => ({ ...s, byId: { ...s.byId, [user.id]: user } }));
}

/** Seed multiple users at once */
export function primeUsers(users: PublicUser[]) {
  if (!users?.length) return;
  usersIndex.set((st) => {
    const next = { ...st.byId };
    for (const u of users) next[u.id] = u;
    return { ...st, byId: next };
  });
}

/** Read helpers */
export function getUser(userId: number): PublicUser | null {
  return usersIndex.get().byId[userId] ?? null;
}

export function isUserLoading(userId: number) {
  return !!usersIndex.get().loading[userId];
}
export function getUserError(userId: number) {
  return usersIndex.get().error[userId] ?? null;
}

/** One shot fetch of a public user; overwrites/creates cache entry */
export async function loadUser(userId: number) {
  const s = usersIndex.get();
  if (s.loading[userId]) return;

  usersIndex.set((st) => ({
    ...st,
    loading: { ...st.loading, [userId]: true },
    error: { ...st.error, [userId]: null },
  }));

  try {
    const user = await UsersAPI.getPublic(userId);
    usersIndex.set((st) => ({
      ...st,
      byId: { ...st.byId, [userId]: user },
      loading: { ...st.loading, [userId]: false },
    }));
    return user;
  } catch (e: any) {
    usersIndex.set((st) => ({
      ...st,
      loading: { ...st.loading, [userId]: false },
      error: { ...st.error, [userId]: e?.message ?? "Failed to load user" },
    }));
    throw e;
  }
}

/** Refresh the authenticated user (me) and prime the cache */
export async function refreshMe() {
  const me = await UsersAPI.me();
  primeUser(me);
}

/**
 * Simple search with paging
 */
// export async function searchUsers(q: string, limit = 20, offset = 0) {
//   users.set((s) => ({ ...s, search: { ...s.search, q, loading: true, limit, offset } }));
//   try {
//     const res = await UsersAPI.searchUser(q, limit, offset);
//     users.set((s) => ({ ...s, search: { ...s.search, loading: false, results: res.users, limit: res.limit, offset: res.offset } }));
//   } catch {
//     users.set((s) => ({ ...s, search: { ...s.search, loading: false, results: [] } }));
//   }
// }
