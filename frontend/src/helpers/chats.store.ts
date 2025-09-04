// src/helpers/chats.store.ts

/**
 * Store that hides http + ws. UI subscribes to state changes
 */

import { type WsIncoming, Realtime } from "./ws";
import * as http from "../api/http";

/**
 * Types exposed to UI
 */

/**
 *
 */
export type PublicUser = { id: number; email: string; pseudo: string; avatar_url: string | null };
export type LastMessage = { id: number; author_id: number | null; body: string | null; created_at: string | null };
export type ChatListItem = { id: number; created_at: string; peer: PublicUser; last_message: any | null };
export type ChatMessage = { id: number; author_id: number; body: string; created_at: string };

/**
 * Single source of truth for the chat view information
 */
type State = {
  list: ChatListItem[];
  messages: Record<number, ChatMessage[]>;
  typing: Record<number, Set<number>>; // chatId -> usersIds typing
  unread: Record<number, number>; // chatId -> count
  loading: boolean;
  error: string | null;
  activeChatId: number | null;
};

/**
 * Minimal reactive state
 */
const state: State = {
  list: [],
  messages: {},
  typing: {},
  unread: {},
  loading: false,
  error: null,
  activeChatId: null,
};

/**
 * Listener management
 */
type Listener = (s: State) => void;

const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) {
    l(state);
  }
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

/**
 * WS wiring
 */
const realtime = new Realtime("/api/ws");
let stopWsListener: (() => void) | null = null;

function onWs(msg: WsIncoming) {
  switch (msg.type) {
    case "ready":
      if (state.activeChatId) realtime.subscribe(state.activeChatId);
      break;

    case "message": {
      const { chatId, message } = msg;
      if (!state.messages[chatId]) state.messages[chatId] = [];
      if (state.messages[chatId].some((m) => m.id === message.id)) break;
      state.messages[chatId].push(message);
      const item = state.list.find((c) => c.id === chatId);
      if (item) item.last_message = message;

      if (state.activeChatId !== chatId) state.unread[chatId] = (state.unread[chatId] ?? 0) + 1;
      emit();
      break;
    }

    case "typing": {
      const { chatId, userId, isTyping } = msg;
      if (!state.typing[chatId]) state.typing[chatId] = new Set();
      isTyping ? state.typing[chatId].add(userId) : state.typing[chatId].delete(userId);
      emit();
      break;
    }

    case "error":
      state.error = `${msg.code}: ${msg.message}`;
      emit();
      break;

    case "pong":
      break;
  }
}

/**
 * Public API
 */
export const Chats = {
  async init() {
    if (!stopWsListener) {
      stopWsListener = realtime.on(onWs);
      realtime.connect();
    }
    await this.refreshList();
  },

  async refreshList() {
    state.loading = true;
    state.error = null;
    emit();

    try {
      const res = await fetch("/api/chats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.list = data.chats; // A modifier pour respecter les structures de données back/front
    } catch (e: any) {
      state.error = e?.message ?? "Failed to load chats";
    } finally {
      state.loading = false;
      emit();
    }
  },

  async ensureChatWith(userId: number) {
    const res = await fetch(`/api/chats/with/${userId}`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { id, peer } = await res.json();
    if (!state.list.some((c) => c.id === id)) {
      state.list.unshift({ id, peer, created_at: new Date().toISOString(), last_message: null });
      emit();
    }
    return id as number;
  },

  setActiveChat(chatId: number | null) {
    if (state.activeChatId && state.activeChatId !== chatId) realtime.unsubscribe(state.activeChatId);
    state.activeChatId = chatId;
    if (chatId) {
      realtime.subscribe(chatId);
      state.unread[chatId] = 0;
    }
    emit();
  },

  async loadMessages(chatId: number, { limit = 50, offset = 0 } = {}) {
    const res = await fetch(`/api/chats/${chatId}/messages?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { messages } = await res.json();
    state.messages[chatId] = messages;
    emit();
  },

  async send(chatId: number, body: string) {
    realtime.send({ type: "send", chatId, body });
  },

  setTyping(chatId: number, isTyping: boolean) {
    realtime.typing(chatId, isTyping);
  },

  getState() {
    return state;
  },

  getMessages(chatId: number) {
    return state.messages[chatId] ?? [];
  },

  getTypingUsers(chatId: number) {
    return [...(state.typing[chatId] ?? new Set())];
  },

  getUnread(chatId: number) {
    return state.unread[chatId] ?? 0;
  },
};
