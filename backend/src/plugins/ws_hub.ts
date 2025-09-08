// src/plugins/ws_hub.ts
import type { Outgoing } from "./ws_types";
import { Rooms } from "./ws_rooms";

let roomsSingleton: Rooms | null = null;

export function setRooms(r: Rooms) {
  roomsSingleton = r;
}

export function broadcastToUsers(userIds: number[], payload: Outgoing) {
  if (!roomsSingleton) return;
  roomsSingleton.broadcastToUsers(userIds, payload);
}

export function broadcastToMatch(matchId: number, payload: Outgoing) {
  if (!roomsSingleton) return;
  roomsSingleton.broadcastToMatch(matchId, payload);
}
