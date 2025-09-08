// src/helpers/chats.store.ts

/**
 * Store that hides http + ws. UI subscribes to state changes
 */

import { type WsIncoming, Realtime } from "./ws";

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
  presence: Record<number, boolean>; // userId -> online ?
  friendRequestsCount: number;
  meId: number | null;
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
  presence: {},
  friendRequestsCount: 0,
  meId: null,
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
      state.meId = msg.userId;
      if (state.activeChatId) realtime.subscribe(state.activeChatId);
      emit();
      break;

    case "message": {
      const { chatId, message } = msg;

      if (!state.messages[chatId]) state.messages[chatId] = [];

      const arr = state.messages[chatId];
      const pendingIdx = arr.findIndex((m) => m.id < 0 && m.author_id === message.author_id && m.body === message.body);
      if (pendingIdx >= 0) arr.splice(pendingIdx, 1);

      // dedupe by id
      if (!arr.some((m) => m.id === message.id)) {
        arr.push(message);
      }

      // update last_message on the chat item
      const idx = state.list.findIndex((c) => c.id === chatId);
      if (idx >= 0) {
        state.list[idx].last_message = message;

        // move this chat top top (sort by recency)
        const [it] = state.list.splice(idx, 1);
        state.list.unshift(it);
      }

      // unread count if not active
      if (state.activeChatId !== chatId) {
        state.unread[chatId] = (state.unread[chatId] ?? 0) + 1;
      }

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

    case "presence": {
      const { userId, online } = msg;
      state.presence[userId] = !!online;
      emit();
      break;
    }

    case "friend_request": {
      state.friendRequestsCount++;
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
let pendingSeq = 0;

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
    const myId = state.meId ?? 0;
    const optimistic = {
      id: -++pendingSeq,
      author_id: myId,
      body,
      created_at: new Date().toISOString(),
    } as ChatMessage;

    if (!state.messages[chatId]) state.messages[chatId] = [];
    state.messages[chatId].push(optimistic);

    const idx = state.list.findIndex((c) => c.id === chatId);
    if (idx >= 0) {
      state.list[idx].last_message = optimistic as any;
      const [it] = state.list.splice(idx, 1);
      state.list.unshift(it);
    }

    emit();

    realtime.send({ type: "send", chatId, body });
  },

  shutdown() {
    if (stopWsListener) {
      stopWsListener();
      stopWsListener = null;
      realtime.close();
    }
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

  getOnline(userId: number) {
    return !!state.presence[userId];
  },

  /** Find a chat id by peer user id (for badges) */
  getChatIdByPeer(userId: number): number | null {
    const item = state.list.find((c) => c.peer?.id === userId);
    return item ? item.id : null;
  },

  /** Chats list already kept sorted by latest; expose it if needed */
  getSortedList() {
    return state.list;
  },

  getFriendRequestsCount() {
    return state.friendRequestsCount;
  },
};
