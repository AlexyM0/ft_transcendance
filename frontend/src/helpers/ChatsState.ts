// src/helpers/ChatsState.ts

/**
 * Store that hides http + ws. UI subscribes to state changes
 */

import { Realtime } from "./ws";
import type { AllWsIncoming, CWOSend, CWOSubscribe, CWOTyping, CWOUnsubscribe } from "./ws_types";
import * as apiFriends from "../api/friends";

/**
 * Types exposed to UI
 */
export type PublicUser = { id: number; email: string; pseudo: string; avatar_url: string | null };
export type LastMessage = { id: number; author_id: number | null; body: string | null; created_at: string | null };
export type ChatListItem = { id: number; created_at: string; peer: PublicUser; last_message: any | null };
export type ChatMessage = { id: number; author_id: number; body: string; created_at: string };
export type Friend = { id: number; name: string; avatar: string | null; online: boolean; last?: string };
export type Msg = { id: number; author_id: number; body: string; at: string };
export type ReqUser = { id: number; name: string; avatar: string | null; requestId: number };

/**
 * Single source of truth for the chat view information
 */
type ChatState = {
  list: ChatListItem[];
  messages: Record<number, ChatMessage[]>;
  typing: Record<number, Set<number>>; // chatId -> usersIds typing
  unread: Record<number, number>; // chatId -> count
  presence: Record<number, boolean>; // userId -> online ?
  meId: number | null;
  loading: boolean;
  error: string | null;
  activeChatId: number | null;
  friends: Friend[];
  requests: {
    received: ReqUser[];
    sent: ReqUser[];
    blocked: ReqUser[];
  };
};

/**
 * Minimal reactive state
 */
const state: ChatState = {
  list: [],
  messages: {},
  typing: {},
  unread: {},
  presence: {},
  meId: null,
  loading: false,
  error: null,
  activeChatId: null,
  friends: [],
  requests: {
    received: [],
    sent: [],
    blocked: [],
  },
};

/**
 * Listener management
 */
type Listener = (s: ChatState) => void;

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

type TypingListener = (chatId: number, usedId: number, isTyping: boolean) => void;
const typingListeners = new Set<TypingListener>();

function emitTyping(chatId: number, userId: number, isTyping: boolean) {
  for (const l of typingListeners) l(chatId, userId, isTyping);
}

export function onTyping(fn: TypingListener) {
  typingListeners.add(fn);
  return () => typingListeners.delete(fn);
}

/**
 * WS wiring
 */
const realtime = new Realtime("/api/ws");

/**
 * **`onWs`** determines the behaviour of the chat state when an incoming web socket message is received
 * @param msg The web socket message received is of type ChatWsIncoming (see ws_types.ts)
 * Depending on msg, an outgoing response might be sent through WebSocket, using realtime.send()
 * This response is of type ChatWsOutgoing (see ws_types.ts)
 */
async function onWs(msg: AllWsIncoming) {
  switch (msg.type) {
    case "ready":
      state.meId = msg.userId;
      if (state.activeChatId) realtime.send({ type: "chat_subscribe", chatId: state.activeChatId } satisfies CWOSubscribe);
      emit();
      break;

    case "chat_message": {
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

    case "chat_typing": {
      const { chatId, userId, isTyping } = msg;
      if (!state.typing[chatId]) state.typing[chatId] = new Set();
      const had = state.typing[chatId].has(userId);

      let changed = false;
      if (isTyping && !had) {
        state.typing[chatId].add(userId);
        changed = true;
      } else if (!isTyping && had) {
        state.typing[chatId].delete(userId);
        changed = true;
      }

      if (changed) emitTyping(chatId, userId, !!isTyping);
      break;
    }

    case "presence": {
      const { userId, online } = msg;
      state.presence[userId] = !!online;
      emit();
      break;
    }

    case "chat_error":
      state.error = `${msg.code}: ${msg.message}`;
      emit();
      break;

    case "pong":
      break;

    case "friend_request_sent": {
      Chats.refreshRequests();
      break;
    }

    case "friend_request_updated":
      if (msg.accepted) {
        await Chats.refreshList();
        await Chats.refreshFriendsAndRequests();
      } else {
        await Chats.refreshRequests();
      }
      break;

    case "friend_deleted":
      const peerId = state.meId === msg.meId ? msg.friendId : msg.meId;
      const chatId = Chats.getChatIdByPeer(peerId);
      if (state.activeChatId && chatId && state.activeChatId === chatId) {
        realtime.send({ type: "chat_unsubscribe", chatId } as CWOUnsubscribe);
        state.activeChatId = null;
      }
      await Chats.refreshFriends();
      await Chats.refreshList();
      break;
  }
}

/**
 * Public API
 */
let pendingSeq = 0;
let stopWsListener: (() => void) | null = null;

/**
 * **`Chats`** encapsulates public interactions with the Chats state
 * Depending on the interaction, an outgoing response might be sent through WebSocket, using realtime.send()
 * This response is of type ChatWsOutgoing (see ws_types.ts)
 */
export const Chats = {
  async init() {
    if (!stopWsListener) {
      stopWsListener = realtime.on(onWs);
      realtime.connect();
    }
    await this.refreshList();
    await this.refreshFriendsAndRequests();
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

  async refreshFriends() {
    try {
      const friendRows = await apiFriends.getFriends();
      state.friends = friendRows.map((u) => ({
        id: u.id,
        name: u.pseudo,
        avatar: u.avatar_url ?? "/user.png",
        online: !!state.presence[u.id],
        last: "",
      }));
    } catch {
    } finally {
      emit();
    }
  },

  async refreshRequests() {
    try {
      const requestsReceived = await apiFriends.getRequestsReceived();
      state.requests.received = await Promise.all(
        requestsReceived.map(async (r) => {
          const sender = await apiFriends.getPublicUser(r.from_user_id);
          return { id: sender.id, name: sender.pseudo, avatar: sender.avatar_url, requestId: r.id };
        })
      );

      const requestsSent = await apiFriends.getRequestsSent();
      state.requests.sent = await Promise.all(
        requestsSent.map(async (r) => {
          const to = await apiFriends.getPublicUser(r.to_user_id);
          return { id: to.id, name: to.pseudo, avatar: to.avatar_url, requestId: r.id };
        })
      );
    } catch (e) {
    } finally {
      emit();
    }
  },

  async refreshFriendsAndRequests() {
    try {
      const friendRows = await apiFriends.getFriends();
      state.friends = friendRows.map((u) => ({
        id: u.id,
        name: u.pseudo,
        avatar: u.avatar_url ?? "/user.png",
        online: !!state.presence[u.id],
        last: "",
      }));

      const requestsReceived = await apiFriends.getRequestsReceived();
      state.requests.received = await Promise.all(
        requestsReceived.map(async (r) => {
          const sender = await apiFriends.getPublicUser(r.from_user_id);
          return { id: sender.id, name: sender.pseudo, avatar: sender.avatar_url, requestId: r.id };
        })
      );

      const requestsSent = await apiFriends.getRequestsSent();
      state.requests.sent = await Promise.all(
        requestsSent.map(async (r) => {
          const to = await apiFriends.getPublicUser(r.to_user_id);
          return { id: to.id, name: to.pseudo, avatar: to.avatar_url, requestId: r.id };
        })
      );
    } catch (e) {
    } finally {
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
    if (state.activeChatId && state.activeChatId !== chatId) realtime.send({ type: "chat_unsubscribe", chatId: state.activeChatId } as CWOUnsubscribe);
    state.activeChatId = chatId;
    if (chatId) {
      realtime.send({ type: "chat_subscribe", chatId: state.activeChatId } as CWOSubscribe);
      state.unread[chatId] = 0;
    }
    emit();
  },

  async loadMessages(chatId: number, { limit = 100, offset = 0 } = {}) {
    const res = await fetch(`/api/chats/${chatId}/messages?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { messages } = await res.json();
    console.log(messages);
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
    realtime.send({ type: "chat_send", chatId, body } as CWOSend);
  },

  shutdown() {
    if (stopWsListener) {
      stopWsListener();
      stopWsListener = null;
      realtime.close();
    }
  },

  setTyping(chatId: number, isTyping: boolean) {
    realtime.send({ type: "chat_typing", chatId, isTyping } as CWOTyping);
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
    return state.requests.received.length;
  },

  getFriends() {
    return state.friends;
  },

  getRequestsReceived() {
    return state.requests.received;
  },

  getRequestsSent() {
    return state.requests.sent;
  },
};
