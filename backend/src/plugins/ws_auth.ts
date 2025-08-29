// ws_auth.ts

/**
 * WebSocket wire protocol (client <-> server).
 *
 * One endpoint (/api/ws), multiple "domains" if needed later.
 * For now we only use the "chat" domain.
 *
 * Client sends:
 *  - subscribe/unsubscribe: start/stop receiving live events for a chat
 *  - send: persist a message in DB and broadcast to subscribers
 *  - typing: ephemeral "user is typing" signal (no DB write)
 *  - ping: keep-alive / latency checks (server replies with "pong")
 *
 * Server sends:
 *  - ready: handshake success (contains userId)
 *  - message: new message persisted and fanned-out
 *  - typing: other user's typing indicator
 *  - error: structured error (e.g., auth, validation, rate-limit)
 *  - pong: reply to ping
 */

import type { FastifyInstance, FastifyRequest } from "fastify";

export async function getUserIdFromRequest(fastify: FastifyInstance, req: FastifyRequest): Promise<number> {
  const token = req.cookies?.["session"];
  if (!token) throw new Error("missing session cookie");

  const decoded: any = await fastify.jwt.verify(token);
  const id = Number(decoded?.sub);
  if (!Number.isInteger(id) || id <= 0) throw new Error("bad sub");
  return id;
}
