// chat.controller.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import * as chatService from "../services/chat.service";
import * as usersService from "../services/user.service";
import { err } from "../utils/errors";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const toInt = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

export async function listChats(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);

  const q = (req.query as any) ?? {};
  const limit = clamp(Number(q.limit ?? 50), 1, 200);
  const offset = Math.max(0, Number(q.offset ?? 0));
  if (!Number.isInteger(limit)) throw err("BAD_LIMIT");
  if (!Number.isInteger(offset)) throw err("BAD_OFFSET");

  const chats = chatService.listMyChats(meId, limit, offset);
  return rep.send({ chats, limit: Number(limit), offset: Number(offset) });
}

export async function getMessagesFromAChat(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const chatId = toInt((req.params as any).chatId);
  if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");

  const q = (req.query as any) ?? {};
  const limit = clamp(Number(q.limit ?? 50), 1, 200);
  const offset = Math.max(0, Number(q.offset ?? 0));
  if (!Number.isInteger(limit)) throw err("BAD_LIMIT");
  if (!Number.isInteger(offset)) throw err("BAD_OFFSET");

  const messages = chatService.getChatMessages(meId, chatId, limit, offset);
  rep.send({ chatId, messages, limit, offset });
}

export async function sendMessage(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);

  const chatId = toInt((req.params as any).chatId);
  if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");

  const { body } = (req.body as any) ?? {};
  const message = chatService.sendChatMessage(meId, chatId, String(body ?? ""));
  return rep.code(201).send(message);
}

export async function ensureChatWithUser(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);

  const otherUserId = toInt((req.params as any).userId);
  if (!Number.isInteger(otherUserId) || otherUserId <= 0) throw err("USER_NOT_FOUND");

  const { id } = chatService.ensureDirectChat(meId, otherUserId);
  const peer = usersService.getPublicProfile(otherUserId);
  return rep.code(201).send({ id, peer });
}

export async function ensureChatAndSend(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);

  const otherUserId = toInt((req.params as any).userId);
  if (!Number.isInteger(otherUserId) || otherUserId <= 0) throw err("USER_NOT_FOUND");

  const { body } = (req.body as any) ?? {};
  const msg = chatService.ensureAndSend(meId, otherUserId, String(body ?? ""));
  return rep.code(201).send(msg);
}
