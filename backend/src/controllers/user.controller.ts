// user.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import * as userService from "../services/user.service";
import { err } from "../utils/errors";
import { off } from "process";
import { MultipartFile } from "@fastify/multipart";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const toInt = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

export async function getMeProfile(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const row = userService.getMe(meId);
  return rep.send(row);
}

export async function updateMeProfile(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const { pseudo, email } = (req.body as any) ?? {};
  const updated = userService.updateMeProfile(meId, { pseudo, email });
  return rep.send(updated);
}

export async function uploadMeAvatar(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  if (!Number.isInteger(meId) || meId <= 0) throw err("USER_NOT_FOUND");

  const avatarFile = await req.file();
  if (!avatarFile || !avatarFile.file) throw err("MISSING_AVATAR_URL");

  const updated = userService.updateMeAvatar(meId, avatarFile as MultipartFile);
  return rep.send(updated);
}

export async function deleteMeAvatar(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const updated = userService.deleteMeAvatar(meId);
  return rep.send(updated);
}

export async function getPublicProfile(req: FastifyRequest, rep: FastifyReply) {
  const userId = Number((req.params as any).id);
  if (!Number.isInteger(userId) || userId <= 0) throw err("BAD_USER_ID");
  const row = userService.getPublicProfile(userId);
  return rep.send(row);
}

export async function getUserMatchHistory(req: FastifyRequest, rep: FastifyReply) {
  const userId = toInt((req.params as any).id);
  if (!Number.isInteger(userId) || userId <= 0) throw err("BAD_USER_ID");

  const q = (req.query as any) ?? {};
  const limit = clamp(Number(q.limit ?? 50), 1, 200);
  const offset = Math.max(0, Number(q.offset ?? 0));
  if (!Number.isInteger(limit)) throw err("BAD_LIMIT");
  if (!Number.isInteger(offset)) throw err("BAD_OFFSET");

  const rows = userService.listUserMatches(userId, limit, offset);
  return rep.send({ userId, matches: rows, limit, offset });
}

export async function getUserStats(req: FastifyRequest, rep: FastifyReply) {
  const userId = toInt((req.params as any).id);
  if (!Number.isInteger(userId) || userId <= 0) throw err("BAD_USER_ID");

  const q = (req.query as any) ?? {};
  const limit = clamp(Number(q.limit ?? 50), 1, 200);
  const offset = Math.max(0, Number(q.offset ?? 0));
  if (!Number.isInteger(limit)) throw err("BAD_LIMIT");
  if (!Number.isInteger(offset)) throw err("BAD_OFFSET");

  const row = userService.getUserStats(userId);
  return rep.send({ stats: row });
}

export async function searchForUser(req: FastifyRequest, rep: FastifyReply) {
  const q = (req.query as any) ?? {};
  const query = String(q.q ?? "").trim();
  const limit = clamp(Number(q.limit ?? 20), 1, 50);
  const offset = Math.max(0, Number(q.offset ?? 0));
  if (!Number.isInteger(limit)) throw err("BAD_LIMIT");
  if (!Number.isInteger(offset)) throw err("BAD_OFFSET");

  const rows = userService.searchUser(String(q), Number(limit), Number(offset));
  return rep.send({ users: rows, limit, offset });
}
