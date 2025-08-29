// src/api/users.ts
import { getRequest, putRequest, deleteRequest } from "./http";
import type { Me, PublicUser, Match } from "./types";

export const UsersAPI = {
  /**
   * GET /api/users/me -> current user
   */
  me: () => getRequest<Me>("/api/users/me"),

  /**
   * PUT /api/users/me -> update pseudo and/or avatar_url
   */
  updateMe: (input: { pseudo?: string; avatar_url?: string | null }) => {
    return putRequest<Me>("/api/users/me", input);
  },

  /**
   * PUT /api/users/me/avatar -> set/replace avatar (url based in the backend)
   */
  uploadAvatar: (avatar_url: string) => {
    return putRequest<Me>("/api/users/me", { avatar_url });
  },

  /**
   * DELETE /api/users/me/avatar
   */
  deleteAvatar: () => deleteRequest<Me>("/api/users/me/avatar"),

  /**
   * GET /api/users/:id -> public profile
   */
  getPublic: (userId: number) => getRequest<PublicUser>(`/api/users/${userId}`),

  /**
   * GET /api/users/:id/matches?limit&offset -> { matches, limit offset }
   */
  listUserMatches: (userId: number, limit = 50, offset = 0) => {
    return getRequest<{ matches: Match[]; limit: number; offset: number }>(`/api/users/${userId}/matches`, { limit, offset });
  },

  /**
   * GET /api/users/search?q&limit&offset -> { users, limit, offset }
   */
  searchUser: (q: string, limit = 20, offset = 0) => {
    return getRequest<{ users: PublicUser[]; limit: number; offset: number }>(`/api/users/search`, { q, limit, offset });
  },
};
