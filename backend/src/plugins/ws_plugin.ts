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
import websocket from "@fastify/websocket";

import { Rooms } from "../utils/ws_rooms";
import { MAX_JSON } from "../types/ws_types";

async function wsPlugin(fastify: FastifyInstance) {
  await fastify.register(websocket, { options: { maxPayload: MAX_JSON } });

  const rooms = new Rooms();
  fastify.decorate("rooms", rooms);
}

export default fp(wsPlugin, { name: "ws" });
