// ws_rooms.ts
import type { WebSocket } from "@fastify/websocket";
import type { Outgoing } from "./ws_types";

export class Rooms {
  /**
   * Maps : chatId -> set of sockets, userId -> set of sockets
   * (One user can have multiple sockets: tabs/devices)
   */
  private chatSubs = new Map<number, Set<WebSocket>>();
  private userSockets = new Map<number, Set<WebSocket>>();

  /**
   * Adds a given socket under the given userId
   */
  addUserSocket(userId: number, ws: WebSocket) {
    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set<WebSocket>());
    this.userSockets.get(userId)!.add(ws);
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
   * Subscribe a given socket to a given chatId
   */
  subscribe(chatId: number, ws: WebSocket) {
    if (!this.chatSubs.has(chatId)) this.chatSubs.set(chatId, new Set<WebSocket>());
    this.chatSubs.get(chatId)!.add(ws);
  }

  /**
   * Unsubscribe a given socket from a given chatId
   */
  unsubscribe(chatId: number, ws: WebSocket) {
    const set = this.chatSubs.get(chatId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.chatSubs.delete(chatId);
  }

  /**
   * Broadcast a payload to all sockets subscribed to a given chatId
   */
  broadcastToChat(chatId: number, payload: Outgoing) {
    const set = this.chatSubs.get(chatId);
    if (!set) return;
    const data = JSON.stringify(payload);
    for (const ws of set) this.safeSend(ws, data);
  }

  /**
   * Broadcast a payload to all sockets for each user in userIds
   */
  broadcastToUsers(userIds: number[], payload: Outgoing) {
    const data = JSON.stringify(payload);
    for (const uid of userIds) {
      const set = this.userSockets.get(uid);
      if (!set) continue;
      for (const ws of set) this.safeSend(ws, data);
    }
  }

  /**
   * Sends data only if the socket is open; swallow network errors
   */
  private safeSend(ws: WebSocket, data: string) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(data);
    } catch {}
  }
}
