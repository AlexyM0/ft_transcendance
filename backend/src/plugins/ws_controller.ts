//ws_controller.ts

/**
 * WebSocket controller = tiny router for frames.
 * It does transport concerns (parse, rate-limit, broadcast), and delegates
 * domain rules to your existing services (no duplication).
 */
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { Incoming, Outgoing, MatchSettingsWire } from "./ws_types";
import { Rooms } from "./ws_rooms";
import { RateLimiter } from "./ws_rateLimiter";
import { err } from "../utils/errors";

import * as chatService from "../services/chat.service";
import * as lobby from "../services/matches.lobby.service";
import * as runtime from "../services/matches.runtime.service";

export class WsController {
  private rateLimiterChats = new RateLimiter(10, 10_000);
  private rateLimiterInputs = new RateLimiter(500, 10_000);

  constructor(private fastify: FastifyInstance, private rooms: Rooms) {}

  private send(ws: WebSocket, payload: Outgoing) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    } catch {}
  }

  private pingFrameHandler(ws: WebSocket) {
    this.send(ws, { type: "pong", at: new Date().toISOString() });
  }

  // CHAT
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
    if (!this.rateLimiterChats.allow(ws)) {
      return this.send(ws, { type: "error", code: "RATE_LIMIT", message: "Too many messages" });
    }

    if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");

    const saved = chatService.sendChatMessage(meId, chatId, body);
    const chat = chatService.assertMembership(meId, chatId);
    const payload: Outgoing = { type: "message", chatId, message: saved };

    this.rooms.broadcastToChat(chatId, payload);
    this.rooms.broadcastToUsers([chat.user_a_id, chat.user_b_id], payload);
  }

  // MATCH / INVITE
  private inviteSend(ws: WebSocket, meId: number, to: number) {
    if (!Number.isInteger(to) || to <= 0) throw err("USER_NOT_FOUND");
    lobby.createInvite(meId, to);
  }

  private inviteCancel(ws: WebSocket, meId: number, inviteId: number) {
    lobby.cancelInvite(inviteId, meId);
  }

  private inviteAnswer(ws: WebSocket, meId: number, inviteId: number, accept: boolean) {
    const gameLobby = lobby.answerInvite(inviteId, meId, accept);
    if (!gameLobby || !accept) return;
  }

  private subscribeMatch(ws: WebSocket, matchId: number) {
    this.rooms.subscribeMatch(matchId, ws);
  }

  private unsubscribeMatch(ws: WebSocket, matchId: number) {
    this.rooms.unsubscribeMatch(matchId, ws);
  }

  private matchSettings(ws: WebSocket, meId: number, matchId: number, settings: MatchSettingsWire) {
    const gameLobby = lobby.getLobby(matchId);
    if (!gameLobby) return;

    if (gameLobby.hostId !== meId) return;
    lobby.setSettings(meId, matchId, settings);
  }

  private matchReady(ws: WebSocket, meId: number, matchId: number, ready: boolean) {
    const res = lobby.setReady(matchId, meId, ready);
    if (!res) return;

    if (res.bothReady) {
      const gameLobby = res.lobby;
      const hostUser = chatService.ensureUserExists(gameLobby.hostId);
      const guestUser = chatService.ensureUserExists(gameLobby.guestId);
      runtime.startRuntime(matchId, gameLobby.hostId, gameLobby.guestId, gameLobby.settings, {
        host: hostUser.pseudo,
        guest: guestUser.pseudo,
      });
    }
  }

  private matchInput(ws: WebSocket, meId: number, matchId: number, key: "up" | "down" | "left" | "right", pressed: boolean) {
    if (!this.rateLimiterInputs.allow(ws)) return;
    runtime.onInput(matchId, meId, key, pressed);
  }

  private matchTogglePause(ws: WebSocket, meId: number, matchId: number) {
    runtime.togglePause(matchId);
  }

  // WS MESSAGE ENGINE
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

      case "invite_send":
        return this.inviteSend(ws, meId, msg.to);
      case "invite_cancel":
        return this.inviteCancel(ws, meId, msg.inviteId);
      case "invite_answer":
        return this.inviteAnswer(ws, meId, msg.inviteId, msg.accept);

      case "subscribe_match":
        return this.subscribeMatch(ws, msg.matchId);
      case "unsubscribe_match":
        return this.unsubscribeMatch(ws, msg.matchId);

      case "match_settings":
        return this.matchSettings(ws, meId, msg.matchId, msg.settings);
      case "match_ready":
        return this.matchReady(ws, meId, msg.matchId, msg.ready);

      case "match_input":
        return this.matchInput(ws, meId, msg.matchId, msg.key, msg.pressed);
      case "match_toggle_pause":
        return this.matchTogglePause(ws, meId, msg.matchId);
    }
  }
}
