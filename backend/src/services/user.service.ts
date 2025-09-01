// user.service.ts
import * as usersModel from "../models/users.model";
import * as usersStatsModel from "../models/user_stats.model";
import * as matchesModel from "../models/matches.model";
import { err } from "../utils/errors";
import { MultipartFile } from "@fastify/multipart";
import path from "path";
import fs from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const PSEUDO_MIN = 1;
const PSEUDO_MAX = 32;
const isLikelyUrl = (s: string) => /^https?:\/\/.+/i.test(s);

const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");

// whitelist mimes → extension
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function getMe(userId: number): usersModel.MeUserRow | undefined {
  const row = usersModel.getMeById(userId);
  if (!row) throw err("USER_NOT_FOUND");
  return row;
}

export function updateMeProfile(userId: number, input: { email?: string; pseudo?: string }) {
  // Normalize
  const email = typeof input.email === "string" ? input.email.trim() : undefined;
  const pseudo = typeof input.pseudo === "string" ? input.pseudo.trim() : undefined;

  // Validate email if provided
  if (email !== undefined) {
    if (email.length < 1 || email.length > 64) throw err("BAD_EMAIL");
  }

  // Validate pseudo if provided
  if (pseudo !== undefined) {
    if (pseudo.length < PSEUDO_MIN || pseudo.length > PSEUDO_MAX) throw err("BAD_PSEUDO");
  }

  try {
    const updated = usersModel.updateMeProfile(userId, { email: email as string, pseudo: pseudo as string });
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

export function updateMeAvatar(meId: number, avatarFile: MultipartFile) {
  const mime = String(avatarFile.mimetype || "");
  const extension = EXT_BY_MIME[mime];

  if (!extension) throw err("UNSUPPORTED_IMAGE_TYPE");
  fs.mkdir(AVATAR_DIR, { recursive: true });
  const filename = `${meId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;
  const diskpath = path.join(AVATAR_DIR, filename);
  pipeline(avatarFile.file, createWriteStream(diskpath));

  const publicUrl = `/uploads/avatars/${filename}`;
  try {
    const updated = usersModel.updateMeProfile(meId, { avatarUrl: publicUrl });
    return updated;
  } catch (e: any) {
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

export function getUserStats(userId: number) {
  const row = usersStatsModel.getStats(userId);
  if (!row) throw err("USER_NOT_FOUND");
  return row;
}
