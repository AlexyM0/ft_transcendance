// user.service.ts
import * as usersModel from "../models/users.model";
import * as matchesModel from "../models/matches.model";
import { err } from "../utils/errors";

const PSEUDO_MIN = 1;
const PSEUDO_MAX = 32;
const isLikelyUrl = (s: string) => /^https?:\/\/.+/i.test(s);
const DEFAULT_AVATAR_URL = "/user.png";

export function getMe(userId: number): usersModel.MeUserRow | undefined {
  const row = usersModel.getMeById(userId);
  if (!row) throw err("USER_NOT_FOUND");
  return row;
}

export function updateMe(userId: number, input: { pseudo?: string; avatar_url?: string | null }) {
  // Normalize
  const pseudo = typeof input.pseudo === "string" ? input.pseudo.trim() : undefined;
  const avatar = input.avatar_url === undefined ? undefined : input.avatar_url === null ? undefined : String(input.avatar_url);

  // Validate pseudo if provided
  if (pseudo !== undefined) {
    if (pseudo.length < PSEUDO_MIN || pseudo.length > PSEUDO_MAX) throw err("BAD_PSEUDO");
  }

  try {
    const updated = usersModel.updateMeProfile(userId, pseudo, avatar);
    return {
      id: updated.id,
      email: updated.email,
      pseudo: updated.pseudo,
      avatar_url: updated.avatar_url,
    };
  } catch (e: any) {
    if (String(e?.message).includes("SQLITE_CONSTRAINT")) throw err("PSEUDO_TAKEN");
    throw e;
  }
}

export function deleteMeAvatar(userId: number) {
  const updated = usersModel.clearAvatar(userId);
  if (!updated) throw err("USER_NOT_FOUND");
  return {
    id: updated.id,
    email: updated.email,
    pseudo: updated.pseudo,
    avatar_url: updated.avatar_url,
  };
}

export function getPublicProfile(userId: number) {
  const row = usersModel.getPublicById(userId);
  if (!row) throw err("USER_NOT_FOUND");
  return row;
}

export function searchUser(query: string, limit = 20, offset = 0) {
  const q = query.trim();
  if (q.length === 0) return [];
  return usersModel.searchUsers(query, limit, offset);
}

export function listUserMatches(userId: number, limit = 50, offset = 0) {
  const row = usersModel.getPublicById(userId);
  if (!row) throw err("USER_NOT_FOUND");
  return matchesModel.listUserMatches(userId, limit, offset);
}
