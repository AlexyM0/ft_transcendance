//ws_controller.ts

/**
 * WebSocket controller = tiny router for frames.
 * It does transport concerns (parse, rate-limit, broadcast), and delegates
 * domain rules to your existing services (no duplication).
 */
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { Incoming, Outgoing } from "./ws_types";
import { Rooms } from "./ws_rooms";
import { RateLimiter } from "./ws_rateLimiter";
import { err } from "../utils/errors";
import * as chatService from "../services/chat.service";

export class WsController {
  private rateLimiter = new RateLimiter(10, 10_000);

  constructor(private fastify: FastifyInstance, private rooms: Rooms) {}

  private send(ws: WebSocket, payload: Outgoing) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    } catch {}
  }

  private pingFrameHandler(ws: WebSocket) {
    this.send(ws, { type: "pong", at: new Date().toISOString() });
  }

  private subscribeFrameHandler(ws: WebSocket, meId: number, chatId: number) {
    if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");
    chatService.assertMembership(meId, chatId);
    this.rooms.subscribe(chatId, ws);
  }

  private unsubscribeFrameHandler(ws: WebSocket, chatId: number) {
    if (!Number.isInteger(chatId) || chatId <= 0) return;
    this.rooms.unsubscribe(chatId, ws);
  }

  private typingFrameHandler(meId: number, chatId: number, isTyping: boolean) {
    if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");
    chatService.assertMembership(meId, chatId);
    this.rooms.broadcastToChat(chatId, {
      type: "typing",
      chatId,
      userId: meId,
      isTyping: !!isTyping,
      at: new Date().toISOString(),
    });
  }

  private sendFrameHandler(ws: WebSocket, meId: number, chatId: number, body: string) {
    if (!this.rateLimiter.allow(ws)) {
      return this.send(ws, { type: "error", code: "RATE_LIMIT", message: "Too many messages" });
    }

    if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");

    const saved = chatService.sendChatMessage(meId, chatId, body);
    const chat = chatService.assertMembership(meId, chatId);
    const payload: Outgoing = { type: "message", chatId, message: saved };

    this.rooms.broadcastToChat(chatId, payload);
    this.rooms.broadcastToUsers([chat.user_a_id, chat.user_b_id], payload);
  }

  async onFrame(ws: WebSocket, meId: number, msg: Incoming) {
    switch (msg.type) {
      case "ping":
        return this.pingFrameHandler(ws);
      case "subscribe":
        return this.subscribeFrameHandler(ws, meId, msg.chatId);
      case "unsubscribe":
        return this.unsubscribeFrameHandler(ws, msg.chatId);
      case "typing":
        return this.typingFrameHandler(meId, msg.chatId, msg.isTyping);
      case "send":
        return this.sendFrameHandler(ws, meId, msg.chatId, msg.body);
    }
  }
}
