// chat.service.ts
import * as chatModel from "../models/chat.model";
import * as usersModel from "../models/users.model";
import { err } from "../utils/errors";

function isParticipant(meId: number, chat: chatModel.ChatRow) {
  return meId === chat.user_a_id || meId === chat.user_b_id;
}

function ensureUserExists(id: number) {
  if (!usersModel.getPublicById(id)) throw err("USER_NOT_FOUND");
}

export function listMyChats(meId: number, limit = 50, offset = 0) {
  const rows = chatModel.listChatsForUser(meId, limit, offset);
  return rows.map((c) => {
    const peerId = meId === c.user_a_id ? c.user_b_id : c.user_a_id;
    const peer = usersModel.getPublicById(peerId);
    return {
      id: c.id,
      created_at: c.created_at,
      peer: peer ?? { id: peerId, pseudo: "(deleted)", avatar_url: null },
      last_message: c.last_msg_id
        ? {
            id: c.last_msg_id,
            author_id: c.last_msg_author_id,
            body: c.last_msg_body,
            created_at: c.last_msg_created_at,
          }
        : null,
    };
  });
}

export function assertMembership(meId: number, chatId: number) {
  const chat = chatModel.getChatById(chatId);
  if (!chat) throw err("CHAT_NOT_FOUND");
  if (!isParticipant(meId, chat)) throw err("CHAT_FORBIDDEN");
  return chat;
}

export function getChatMessages(meId: number, chatId: number, limit = 50, offset = 0) {
  assertMembership(meId, chatId);
  return chatModel.listMessagesAsc(chatId, limit, offset);
}

export function sendChatMessage(meId: number, chatId: number, body: string) {
  if (typeof body !== "string" || body.trim().length === 0) throw err("CHAT_BODY_EMPTY");
  const clean = body.trim();
  if (clean.length > 1000) throw err("CHAT_BODY_TOO_LONG");

  assertMembership(meId, chatId);
  const { id, created_at } = chatModel.postMessage(chatId, meId, clean);
  return { id, chat_id: chatId, author_id: meId, body: clean, created_at };
}

export function ensureDirectChat(meId: number, otherUserId: number) {
  if (meId === otherUserId) throw err("SELF_CHAT_FORBIDDEN");
  ensureUserExists(otherUserId);
  const { id } = chatModel.ensureChat(meId, otherUserId);
  return { id };
}

export function ensureAndSend(meId: number, otherUserId: number, body: string) {
  const { id: chatId } = ensureDirectChat(meId, otherUserId);
  return sendChatMessage(meId, chatId, body);
}
