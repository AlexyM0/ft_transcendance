//ws_controller.ts

/**
 * WebSocket controller = tiny router for frames.
 * It does transport concerns (parse, rate-limit, broadcast), and delegates
 * domain rules to your existing services (no duplication).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import type {
  AllWsOutgoing,
  AllWsIncoming,
  SWOPong,
  LWIInviteSend,
  SWIPing,
  LWIInviteCancel,
  LWIInviteAnswer,
  LWISetSettings,
  LWIReady,
  LWILeave,
  MWISubscribe,
  MWIUnsubscribe,
  MWIInput,
  MWITogglePause,
  CWISubscribe,
  CWIUnsubscribe,
  CWITyping,
  CWISend,
  CWOTyping,
  CWOMessage,
  SWOReady,
} from "../types/ws_types";
import { Rooms } from "../utils/ws_rooms";
import { RateLimiter } from "../utils/ws_rateLimiter";
import { err } from "../utils/errors";

import * as chatService from "../services/chat.service";

export class WsController {
  private rateLimiterInputs = new RateLimiter(500, 10_000);
  private rateLimiterChats = new RateLimiter(10, 10_000);

  constructor(private fastify: FastifyInstance, private rooms: Rooms) {}

  private safeSendJSON(ws: WebSocket, payload: AllWsOutgoing) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    } catch {}
  }

  private assertNever(x: AllWsIncoming): never {
    throw new Error(`Unhandled WS type: ${(x as any)?.type}`);
  }

  /** -- Behaviour depending on the incoming ws message type */
  async onFrame(ws: WebSocket, meId: number, msg: AllWsIncoming) {
    try {
      switch (msg.type) {
        case "ping":
          return this.handleOFPing(ws, meId, msg);

        case "lobby_invite_send":
          return this.handleOFLobbyInviteSend(ws, meId, msg);

        case "lobby_invite_cancel":
          return this.handleOFLobbyInviteCancel(ws, meId, msg);
        case "lobby_invite_answer":
          return this.handleOFLobbyInviteAnswer(ws, meId, msg);
        case "lobby_set_settings":
          return this.handleOFLobbySetSettings(ws, meId, msg);
        case "lobby_ready":
          return this.handleOFLobbyReady(ws, meId, msg);
        case "lobby_leave":
          return this.handleOFLobbyLeave(ws, meId, msg);

        case "match_subscribe":
          return this.handleOFMatchSubscribe(ws, meId, msg);
        case "match_unsubscribe":
          return this.handleOFMatchUnsubscribe(ws, meId, msg);
        case "match_input":
          return this.handleOFMatchInput(ws, meId, msg);
        case "match_toggle_pause":
          return this.handleOFMatchTogglePause(ws, meId, msg);

        case "chat_subscribe":
          return this.handleOFChatSubscribe(ws, meId, msg);
        case "chat_unsubscribe":
          return this.handleOFChatUnsubscribe(ws, meId, msg);
        case "chat_typing":
          return this.handleOFChatTyping(ws, meId, msg);
        case "chat_send":
          return this.handleOFChatSend(ws, meId, msg);

        default:
          this.assertNever(msg);
      }
    } catch (e: any) {
      this.safeSendJSON(ws, { type: "error", code: e?.code ?? "WS_ERROR", message: e?.message ?? "Error" });
    }
  }

  /** -- onFrame Handlers */
  /** -- PING */
  handleOFPing(ws: WebSocket, meId: number, msg: SWIPing) {
    this.safeSendJSON(ws, { type: "pong", at: new Date().toISOString() } satisfies SWOPong);
  }

  /** -- LOBBY */
  handleOFLobbyInviteSend(ws: WebSocket, meId: number, msg: LWIInviteSend) {}

  handleOFLobbyInviteCancel(ws: WebSocket, meId: number, msg: LWIInviteCancel) {}

  handleOFLobbyInviteAnswer(ws: WebSocket, meId: number, msg: LWIInviteAnswer) {}

  handleOFLobbySetSettings(ws: WebSocket, meId: number, msg: LWISetSettings) {}

  handleOFLobbyReady(ws: WebSocket, meId: number, msg: LWIReady) {}

  handleOFLobbyLeave(ws: WebSocket, meId: number, msg: LWILeave) {}

  /** -- MATCH */
  handleOFMatchSubscribe(ws: WebSocket, meId: number, msg: MWISubscribe) {}

  handleOFMatchUnsubscribe(ws: WebSocket, meId: number, msg: MWIUnsubscribe) {}

  handleOFMatchInput(ws: WebSocket, meId: number, msg: MWIInput) {}

  handleOFMatchTogglePause(ws: WebSocket, meId: number, msg: MWITogglePause) {}

  /** -- CHAT */
  handleOFChatSubscribe(ws: WebSocket, meId: number, msg: CWISubscribe) {
    const chatId = msg.chatId;
    if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");
    chatService.assertMembership(meId, chatId);
    this.rooms.subscribeChatWs(msg.chatId, ws);
  }

  handleOFChatUnsubscribe(ws: WebSocket, meId: number, msg: CWIUnsubscribe) {
    const chatId = msg.chatId;
    if (!Number.isInteger(chatId) || chatId <= 0) return;
    this.rooms.unsubscribeChatWs(chatId, ws);
  }

  handleOFChatTyping(ws: WebSocket, meId: number, msg: CWITyping) {
    const chatId = msg.chatId;
    if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");
    chatService.assertMembership(meId, chatId);
    this.rooms.broadcastToChat(chatId, {
      type: "chat_typing",
      chatId,
      userId: meId,
      isTyping: !!msg.isTyping,
      at: new Date().toISOString(),
    } satisfies CWOTyping);
  }

  handleOFChatSend(ws: WebSocket, meId: number, msg: CWISend) {
    if (!this.rateLimiterChats.allow(ws)) {
      return this.safeSendJSON(ws, { type: "error", code: "RATE_LIMIT", message: "Too many messages" });
    }

    const chatId = msg.chatId;
    if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");

    const saved = chatService.sendChatMessage(meId, chatId, msg.body);
    chatService.assertMembership(meId, chatId);

    this.rooms.broadcastToChat(chatId, { type: "chat_message", chatId, message: saved.body } satisfies CWOMessage);
  }
}

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

export function createWsRouteHandler(fastify: FastifyInstance, rooms: Rooms, controller: WsController) {
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
  };
}

export function wsController(ws: WebSocket, req: FastifyRequest) {
  const meId = Number((req.user as any).sub);
  if (!meId) {
    safeSendJson(ws, { type: "error", code: "UNAUTHORIZED", message: "Invalid or missing session" } satisfies SWOError);
    return ws.close(4401, "unauthorized");
  }

  /** -- Register socket & handshake */
  const rooms = req.server.rooms;
  rooms.addUserSocket(meId, ws);
  safeSendJson(ws, { type: "ready", userId: meId } as SWOReady);

  /** -- Notify friends that i am online */
  void notifyMeOnlineToFriends(rooms, meId);
  void getMyOnlineFriends(ws, rooms, meId);

  /** -- Handle ws interactions (incoming message or close signal) */
  ws.on("message", async (raw) => handlingWsOnMessage(raw, ws, controller, meId));
  ws.on("close", () => handlingWsOnClose(rooms, ws, meId));
}
