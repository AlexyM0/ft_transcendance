// src/store/users.ts
import { createStore } from "./createStore";
import { UsersAPI } from "../api/users";
import type { Me, PublicUser } from "../api/types";

export type UsersState = {
  meUpdating: boolean;
  search: {
    q: string;
    loading: boolean;
    results: PublicUser[];
    limit: number;
    offset: number;
  };
};

export const users = createStore<UsersState>({
  meUpdating: false,
  search: {
    q: "",
    loading: false,
    results: [],
    limit: 20,
    offset: 0,
  },
});

/**
 * Update current user
 */
export async function updateMe(input: { pseudo?: string; avatar_url?: string | null }) {
  users.set((s) => ({ ...s, meUpdating: true }));
  try {
    const me: Me = await UsersAPI.updateMe(input);
    const { auth } = await import("./auth");
    auth.set((s) => ({ ...s, me }));
  } finally {
    users.set((s) => ({ ...s, meUpdating: false }));
  }
}

/**
 * Uploading avatar
 */
export async function uploadAvatar(url: string) {
  users.set((s) => ({ ...s, meUpdating: true }));
  try {
    const me: Me = await UsersAPI.uploadAvatar(url);
    const { auth } = await import("./auth");
    auth.set((s) => ({ ...s, me }));
  } finally {
    users.set((s) => ({ ...s, meUpdating: false }));
  }
}

/**
 * Deleting avatar
 */
export async function deleteAvatar() {
  users.set((s) => ({ ...s, meUpdating: true }));
  try {
    const me: Me = await UsersAPI.deleteAvatar();
    const { auth } = await import("./auth");
    auth.set((s) => ({ ...s, me }));
  } finally {
    users.set((s) => ({ ...s, meUpdating: false }));
  }
}

/**
 * Simple search with paging
 */
export async function searchUsers(q: string, limit = 20, offset = 0) {
  users.set((s) => ({ ...s, search: { ...s.search, q, loading: true, limit, offset } }));
  try {
    const res = await UsersAPI.searchUser(q, limit, offset);
    users.set((s) => ({ ...s, search: { ...s.search, loading: false, results: res.users, limit: res.limit, offset: res.offset } }));
  } catch {
    users.set((s) => ({ ...s, search: { ...s.search, loading: false, results: [] } }));
  }
}
