// ws_plugin.ts
/**
 * This plugin exposes GET /api/ws (HTTP handshake) and then switches
 * the connection to the WebSocket protocol (101 Switching Protocols).
 *
 * After the upgrade:
 *  - We authenticate using the same session cookie as HTTP routes
 *  - We register the socket under the user's id
 *  - We listen for JSON frames and forward them to the WsController
 *  - We clean up on close (unsubscribe rooms, remove from user sockets)
 */

import fp from "fastify-plugin";
import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "@fastify/websocket";
import type { RawData } from "ws";
import type { AllWsIncoming, AllWsOutgoing, SWOError, SWOReady, CWOPresence } from "../types/ws_types";

import { Rooms } from "../utils/ws_rooms";
import { WsController } from "../controllers/ws.controller";
import * as friendsModel from "../models/friends.model";

const MAX_JSON = 4 * 1024;

function safeSendJson(ws: WebSocket, payload: AllWsOutgoing) {
  try {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  } catch {}
}

async function notifyMeOnlineToFriends(rooms: Rooms, meId: number) {
  try {
    const friendRows = friendsModel.listMyFriends(meId);
    const friendIds = friendRows.map((r) => r.friend_id);
    rooms.broadcastToUsers(friendIds, { type: "presence", userId: meId, online: true });
  } catch {}
}

async function getMyOnlineFriends(ws: WebSocket, rooms: Rooms, meId: number) {
  try {
    const friendRows = friendsModel.listMyFriends(meId);
    for (const r of friendRows) {
      const online = rooms.hasOnline(r.friend_id);
      safeSendJson(ws, { type: "presence", userId: r.friend_id, online });
    }
  } catch {}
}

async function handlingWsOnMessage(raw: RawData, ws: WebSocket, controller: WsController, meId: number) {
  /** Check that we have raw data */
  const txt = typeof raw === "string" ? raw : Buffer.isBuffer(raw) ? raw.toString("utf8") : "";
  if (!txt || txt.length > MAX_JSON) return;

  /** Parse txt to JSON */
  let msg: AllWsIncoming;
  try {
    msg = JSON.parse(txt);
  } catch {
    return safeSendJson(ws, { type: "error", code: "BAD_JSON", message: "Invalid JSON" } satisfies SWOError);
  }

  /** Delegate to controller to handle the message type */
  try {
    await controller.onFrame(ws, meId, msg);
  } catch (e: any) {
    const code = e?.code ?? "WS_ERROR";
    const message = e?.message ?? "Error";
    safeSendJson(ws, { type: "error", code, message } satisfies SWOError);
  }
}

async function handlingWsOnClose(rooms: Rooms, ws: WebSocket, meId: number) {
  rooms.removeUserSocket(meId, ws);
  rooms.cleanupSocket(ws);

  try {
    const friendRows = friendsModel.listMyFriends(meId);
    const friendIds = friendRows.map((r) => r.friend_id);
    rooms.broadcastToUsers(friendIds, { type: "presence", userId: meId, online: false } satisfies CWOPresence);
  } catch {}
}

function createWsRouteHandler(fastify: FastifyInstance, rooms: Rooms, controller: WsController) {
  return async function wsRouteHandler(ws: WebSocket, req: FastifyRequest) {
    /** -- Authentication */
    const meId = Number((req.user as any).sub);
    if (!meId) {
      safeSendJson(ws, { type: "error", code: "UNAUTHORIZED", message: "Invalid or missing session" } satisfies SWOError);
      return ws.close(4401, "unauthorized");
    }

    /** -- Register socket & handshake */
    rooms.addUserSocket(meId, ws);
    safeSendJson(ws, { type: "ready", userId: meId } as SWOReady);

    /** -- Notify friends that i am online */
    void notifyMeOnlineToFriends(rooms, meId);
    void getMyOnlineFriends(ws, rooms, meId);

    /** -- Handle ws interactions (incoming message or close signal) */
    ws.on("message", async (raw) => handlingWsOnMessage(raw, ws, controller, meId));
    ws.on("close", () => handlingWsOnClose(rooms, ws, meId));
  };
}

export const wsRoutes: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  fastify.get("/api/ws", { websocket: true }, userController.getAllUsers);
};

async function wsPlugin(fastify: FastifyInstance) {
  await fastify.register(websocket, { options: { maxPayload: MAX_JSON } });

  const rooms = new Rooms();
  fastify.decorate("rooms", rooms);
  const controller = new WsController(fastify, rooms);

  fastify.get("/api/ws", { websocket: true }, createWsRouteHandler(fastify, rooms, controller));
}

export default fp(wsPlugin, { name: "ws" });
