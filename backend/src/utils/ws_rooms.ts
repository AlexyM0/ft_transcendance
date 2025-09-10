// ws_rooms.ts
import type { WebSocket } from "@fastify/websocket";
import type { AllWsOutgoing, ChatWsOutgoing, LobbyWsOutgoing, MatchWsOutgoing } from "../types/ws_types";

export class Rooms {
  /**
   * Maps :
   * userId -> set of sockets
   * inviteId -> set of sockets
   * matchId -> set of sockets
   * chatId -> set of sockets
   * (One user can have multiple sockets: tabs/devices)
   */
  private userSockets = new Map<number, Set<WebSocket>>();
  private inviteSubs = new Map<number, Set<WebSocket>>();
  private matchSubs = new Map<number, Set<WebSocket>>();
  private chatSubs = new Map<number, Set<WebSocket>>();

  /**
   * Reverse map: per-socket memberships, used for cleanup
   */
  private socketIndex = new WeakMap<WebSocket, { invites: Set<number>; matches: Set<number>; chats: Set<number> }>();

  private idx(ws: WebSocket) {
    let rec = this.socketIndex.get(ws);
    if (!rec) {
      rec = {
        invites: new Set(),
        matches: new Set(),
        chats: new Set(),
      };
      this.socketIndex.set(ws, rec);
    }
    return rec;
  }

  /**
   * Sends data only if the socket is open; swallow network errors
   */
  private safeSend(ws: WebSocket, data: string) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(data);
    } catch {}
  }

  /* ====================================================== */
  /* ====================== SETUP ========================== */
  /* ====================================================== */
  /**
   * Adds a given socket under the given userId
   */
  addUserSocket(userId: number, ws: WebSocket) {
    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set<WebSocket>());
    this.userSockets.get(userId)!.add(ws);
    this.idx(ws);
  }

  /**
   * Removes a given socket from the give userId's set; delete the set if empty
   */
  removeUserSocket(userId: number, ws: WebSocket) {
    const set = this.userSockets.get(userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.userSockets.delete(userId);
  }

  /**
   * Clean an open web socket while closing
   */
  cleanupSocket(ws: WebSocket) {
    const rec = this.socketIndex.get(ws);
    if (!rec) return;

    for (const inviteId of rec.invites) {
      const set = this.inviteSubs.get(inviteId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) this.inviteSubs.delete(inviteId);
      }
    }

    for (const matchId of rec.matches) {
      const set = this.matchSubs.get(matchId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) this.matchSubs.delete(matchId);
      }
    }
    for (const chatId of rec.chats) {
      const set = this.chatSubs.get(chatId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) this.chatSubs.delete(chatId);
      }
    }
    this.socketIndex.delete(ws);
  }

  /* ====================================================== */
  /* ================ USER CONNECTED ====================== */
  /* ====================================================== */

  /**
   * Broadcast a payload to all sockets for each user in userIds
   */
  broadcastToUsers(userIds: number[], payload: AllWsOutgoing) {
    const data = JSON.stringify(payload);
    for (const uid of userIds) {
      const set = this.userSockets.get(uid);
      if (!set) continue;
      for (const ws of set) this.safeSend(ws, data);
    }
  }

  hasOnline(userId: number) {
    const set = this.userSockets.get(userId);
    return !!set && set.size > 0;
  }

  /* ====================================================== */
  /* ======================= LOBBY ======================== */
  /* ====================================================== */

  subscribeLobbyWs(inviteId: number, ws: WebSocket) {
    if (!this.inviteSubs.has(inviteId)) this.inviteSubs.set(inviteId, new Set());
    this.inviteSubs.get(inviteId)!.add(ws);
    this.idx(ws).invites.add(inviteId);
  }

  unsubscribeLobbyWs(inviteId: number, ws: WebSocket) {
    const set = this.inviteSubs.get(inviteId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.inviteSubs.delete(inviteId);
    this.idx(ws).invites.delete(inviteId);
  }

  broadcastToLobby(inviteId: number, payload: LobbyWsOutgoing) {
    const set = this.inviteSubs.get(inviteId);
    if (!set) return;
    const data = JSON.stringify(payload);
    for (const ws of set) this.safeSend(ws, data);
  }
  /* ====================================================== */
  /* ======================= MATCH ======================== */
  /* ====================================================== */
  /**
   * Subscribe a socket to a given matchId
   */
  subscribeMatch(matchId: number, ws: WebSocket) {
    if (!this.matchSubs.has(matchId)) this.matchSubs.set(matchId, new Set());
    this.matchSubs.get(matchId)!.add(ws);
    this.idx(ws).matches.add(matchId);
  }

  /**
   * Unsubscribe a given socket from a given matchId
   */
  unsubscribeMatch(matchId: number, ws: WebSocket) {
    const set = this.matchSubs.get(matchId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.matchSubs.delete(matchId);
    this.idx(ws).matches.delete(matchId);
  }

  /**
   * Broadcast a payload to all sockets subscribed to a given matchId
   */
  broadcastToMatch(matchId: number, payload: MatchWsOutgoing) {
    const set = this.matchSubs.get(matchId);
    if (!set) return;
    const data = JSON.stringify(payload);
    for (const ws of set) this.safeSend(ws, data);
  }

  /* ====================================================== */
  /* ======================= CHAT ========================= */
  /* ====================================================== */
  /**
   * Subscribe a given socket to a given chatId
   */
  subscribeChatWs(chatId: number, ws: WebSocket) {
    if (!this.chatSubs.has(chatId)) this.chatSubs.set(chatId, new Set<WebSocket>());
    this.chatSubs.get(chatId)!.add(ws);
    this.idx(ws).chats.add(chatId);
  }

  /**
   * Unsubscribe a given socket from a given chatId
   */
  unsubscribeChatWs(chatId: number, ws: WebSocket) {
    const set = this.chatSubs.get(chatId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.chatSubs.delete(chatId);
    this.idx(ws).chats.delete(chatId);
  }

  /**
   * Broadcast a payload to all sockets subscribed to a given chatId
   */
  broadcastToChat(chatId: number, payload: ChatWsOutgoing) {
    const set = this.chatSubs.get(chatId);
    if (!set) return;
    const data = JSON.stringify(payload);
    for (const ws of set) this.safeSend(ws, data);
  }
}
