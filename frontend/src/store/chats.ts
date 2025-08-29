// src/store/chats.ts
import { createStore } from "./createStore";
import { ChatsAPI } from "../api/chats";
import type { ChatListItem, Message } from "../api/types";

export type ChatsState = {
  loading: boolean;
  list: ChatListItem[];
  limit: number;
  offset: number;

  messages: Record<number, { loading: boolean; items: Message[]; limit: number; offset: number }>;
  sending: Record<number, boolean>;
  error: string | null;
};

export const chats = createStore<ChatsState>({
  loading: false,
  list: [],
  limit: 50,
  offset: 0,
  messages: {},
  sending: {},
  error: null,
});

// Helpers
function ensureMsgBucket(state: ChatsState, chatId: number) {
  if (!state.messages[chatId]) {
    state.messages[chatId] = { loading: false, items: [], limit: 50, offset: 0 };
  }
}

// Actions
export async function loadMyChats(limit = 50, offset = 0) {
  chats.set((s) => ({ ...s, loading: true, error: null }));
  try {
    const res = await ChatsAPI.listMyChats(limit, offset);
    chats.set((s) => ({ ...s, list: res.chats, limit: res.limit, offset: res.offset, loading: false }));
  } catch (e: any) {
    chats.set((s) => ({ ...s, loading: false, error: e?.message ?? "Failed to load chats" }));
  }
}

export async function loadMessages(chatId: number, limit = 50, offset = 0) {
  chats.set((s) => {
    const copy = { ...s };
    ensureMsgBucket(copy, chatId);
    copy.messages[chatId] = { ...copy.messages[chatId], loading: true };
    return copy;
  });
  try {
    const res = await ChatsAPI.getMessages(chatId, limit, offset);
    chats.set((s) => {
      const copy = { ...s };
      ensureMsgBucket(copy, chatId);
      copy.messages[chatId] = {
        loading: false,
        limit: res.limit,
        offset: res.offset,
        items: res.messages,
      };
      return copy;
    });
  } catch (e: any) {
    chats.set((s) => {
      const copy = { ...s };
      ensureMsgBucket(copy, chatId);
      copy.messages[chatId] = { ...copy.messages[chatId], loading: false };
      copy.error = e?.message ?? "Failed to load messages";
      return copy;
    });
  }
}

export async function sendMessage(chatId: number, body: string) {
  chats.set((s) => ({ ...s, sending: { ...s.sending, [chatId]: true } }));
  try {
    const msg = await ChatsAPI.sendMessage(chatId, body);
    chats.set((s) => {
      const copy = { ...s };
      ensureMsgBucket(copy, chatId);
      copy.messages[chatId] = {
        ...copy.messages[chatId],
        items: [...copy.messages[chatId].items, msg],
      };
      // Also refresh the chat list last_message field for this chatId
      copy.list = copy.list.map((c) => (c.id === chatId ? { ...c, last_message: { id: msg.id, author_id: msg.author_id, body: msg.body, created_at: msg.created_at } } : c));
      copy.sending = { ...copy.sending, [chatId]: false };
      return copy;
    });
  } catch (e: any) {
    chats.set((s) => ({ ...s, sending: { ...s.sending, [chatId]: false } }));
    throw e;
  }
}

export async function ensureChatWith(userId: number) {
  const { id, peer } = await ChatsAPI.ensureChatWithUser(userId);

  // Merge chat into list if missing
  chats.set((s) => {
    if (s.list.some((c) => c.id === id)) return s;
    return { ...s, list: [{ id, created_at: new Date().toISOString(), peer, last_message: null }, ...s.list] };
  });
  return id;
}

export async function ensureChatAndSend(userId: number, body: string) {
  const msg = await ChatsAPI.ensureChatAndSend(userId, body);

  chats.set((s) => {
    const copy = { ...s };
    const existing = copy.list.find((c) => c.id === msg.chat_id);
    if (!existing) {
      // We don't know peer data here; safest is to refresh chat list outside or ensureChatWith first
      copy.list = [{ id: msg.chat_id, created_at: msg.created_at, peer: { id: userId, pseudo: "(loading...)", avatar_url: null }, last_message: null }, ...copy.list];
    }
    ensureMsgBucket(copy, msg.chat_id);
    copy.messages[msg.chat_id].items = [...copy.messages[msg.chat_id].items, msg];
    return copy;
  });

  return msg;
}
