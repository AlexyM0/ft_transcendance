// users.model.ts
import { db } from "../utils/db";

export type PublicUserRow = {
  id: number;
  pseudo: string;
  avatar_url: string | null;
};

export type MeUserRow = {
  id: number;
  email: string;
  pseudo: string;
  is_2fa_enabled: 0 | 1;
  avatar_url: string | null;
};

/**
 * SQL commands
 */
const selectPublicById = db.prepare(`SELECT id, pseudo, avatar_url FROM users WHERE id = ?`);
const selectMeById = db.prepare(`SELECT id, email, pseudo, is_2fa_enabled, avatar_url FROM users WHERE id = ?`);

const updateProfileQuery = db.prepare(
  `UPDATE users SET email = COALESCE(?, email), pseudo = COALESCE(?, pseudo), avatar_url = COALESCE(?, avatar_url) WHERE id = ? RETURNING id, email, pseudo, avatar_url`
);
const clearAvatarQuery = db.prepare(`UPDATE users SET avatar_url = NULL WHERE id = ? RETURNING id, email, pseudo, avatar_url`);
const searchUsersQuery = db.prepare(`SELECT id, pseudo, avatar_url FROM users WHERE pseudo LIKE ? COLLATE NOCASE ORDER BY pseudo LIMIT ? OFFSET ?`);

/**
 * Model functions
 */
export function getPublicById(id: number): PublicUserRow | undefined {
  return selectPublicById.get(id) as PublicUserRow | undefined;
}

export function getMeById(id: number): MeUserRow | undefined {
  return selectMeById.get(id) as MeUserRow | undefined;
}

export function updateMeProfile(userId: number, input: { email?: string; pseudo?: string; avatarUrl?: string }) {
  return updateProfileQuery.get(input?.email ?? null, input?.pseudo ?? null, input?.avatarUrl ?? null, userId) as {
    id: number;
    email: string;
    pseudo: string;
    avatar_url: string | null;
  };
}

export function clearAvatar(userId: number) {
  return clearAvatarQuery.get(userId) as {
    id: number;
    email: string;
    pseudo: string;
    avatar_url: string | null;
  };
}

export function searchUsers(query: string, limit = 20, offset = 0): PublicUserRow[] {
  return searchUsersQuery.all(`%${query}%`, limit, offset) as PublicUserRow[];
}
