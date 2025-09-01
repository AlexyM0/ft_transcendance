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
import { FastifyInstance, FastifyRequest } from "fastify";
import websocket, { WebsocketHandler } from "@fastify/websocket";
import type { WebSocket } from "@fastify/websocket";
import { Rooms } from "./ws_rooms";
import { WsController } from "./ws_controller";
import { getUserIdFromRequest } from "./ws_auth";
import { Incoming, Outgoing } from "./ws_types";

const MAX_JSON = 4 * 1024;

async function wsPlugin(fastify: FastifyInstance) {
  await fastify.register(websocket, { options: { maxPayload: MAX_JSON } });

  const rooms = new Rooms();
  const controller = new WsController(fastify, rooms);

  fastify.get("/api/ws", { websocket: true }, async (ws: WebSocket, req: FastifyRequest) => {
    let meId: number;
    try {
      meId = await getUserIdFromRequest(fastify, req);
    } catch {
      const payload: Outgoing = { type: "error", code: "UNAUTHORIZED", message: "Invalid or missing session" };
      ws.send(JSON.stringify(payload));
      return ws.close(4401, "unauthorized");
    }

    rooms.addUserSocket(meId, ws);

    ws.send(JSON.stringify({ type: "ready", userId: meId } as Outgoing));

    const mySubs = new Set<number>();

    ws.on("message", async (raw) => {
      const txt = typeof raw === "string" ? raw : Buffer.isBuffer(raw) ? raw.toString("utf8") : "";
      if (!txt || txt.length > MAX_JSON) return;

      let msg: Incoming;
      try {
        msg = JSON.parse(txt);
      } catch {
        return ws.send(JSON.stringify({ type: "error", code: "BAD_JSON", message: "Invalid JSON" } satisfies Outgoing));
      }

      if (msg.type === "subscribe" && Number.isInteger(msg.chatId)) mySubs.add(msg.chatId);
      if (msg.type === "unsubscribe" && Number.isInteger(msg.chatId)) mySubs.delete(msg.chatId);

      try {
        await controller.onFrame(ws, meId, msg);
      } catch (e: any) {
        const code = e?.code ?? "WS_ERROR";
        const message = e?.message ?? "Error";
        ws.send(JSON.stringify({ type: "error", code, message } satisfies Outgoing));
      }
    });

    ws.on("close", () => {
      rooms.removeUserSocket(meId, ws);
      for (const c of mySubs) rooms.unsubscribe(c, ws);
      mySubs.clear();
    });
  });
}

export default fp(wsPlugin, { name: "ws" });
