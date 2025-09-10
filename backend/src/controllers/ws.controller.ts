//ws_controller.ts

/**
 * WebSocket controller = tiny router for frames.
 * It does transport concerns (parse, rate-limit, broadcast), and delegates
 * domain rules to your existing services (no duplication).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RawData, WebSocket } from "ws";
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
  SWOError,
  CWOPresence,
} from "../types/ws_types";
import { Rooms } from "../utils/ws_rooms";
import { RateLimiter } from "../utils/ws_rateLimiter";
import { err } from "../utils/errors";
import { MAX_JSON } from "../types/ws_types";

import * as chatService from "../services/chat.service";
import * as friendsModel from "../models/friends.model";

/* =========================================================== */
/* =========================================================== */
/* =========================================================== */

const rateLimiterInputs = new RateLimiter(500, 10_000);
const rateLimiterChats = new RateLimiter(10, 10_000);

function safeSendJSON(ws: WebSocket, payload: AllWsOutgoing) {
  try {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  } catch {}
}

function assertNever(x: AllWsIncoming): never {
  throw new Error(`Unhandled WS type: ${(x as any)?.type}`);
}

/* =========================================================== */
/* =========================================================== */
/* =========================================================== */

export function wsController(ws: WebSocket, req: FastifyRequest) {
  const meId = Number((req.user as any).sub);
  if (!meId) {
    safeSendJSON(ws, { type: "error", code: "UNAUTHORIZED", message: "Invalid or missing session" } satisfies SWOError);
    return ws.close(4401, "unauthorized");
  }

  /** -- Register socket & handshake */
  const rooms = req.server.rooms;
  rooms.addUserSocket(meId, ws);
  safeSendJSON(ws, { type: "ready", userId: meId } as SWOReady);

  /** -- Notify friends that i am online */
  void notifyMeOnlineToFriends(rooms, meId);
  void getMyOnlineFriends(ws, rooms, meId);

  /** -- Handle ws interactions (incoming message or close signal) */
  ws.on("message", async (raw) => handlingWsOnMessage(raw, rooms, ws, meId));
  ws.on("close", () => handlingWsOnClose(rooms, ws, meId));
}

/* =========================================================== */
/* =========================================================== */
/* =========================================================== */

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
      safeSendJSON(ws, { type: "presence", userId: r.friend_id, online });
    }
  } catch {}
}

async function handlingWsOnMessage(raw: RawData, rooms: Rooms, ws: WebSocket, meId: number) {
  /** Check that we have raw data */
  const txt = typeof raw === "string" ? raw : Buffer.isBuffer(raw) ? raw.toString("utf8") : "";
  if (!txt || txt.length > MAX_JSON) return;

  /** Parse txt to JSON */
  let msg: AllWsIncoming;
  try {
    msg = JSON.parse(txt);
  } catch {
    return safeSendJSON(ws, { type: "error", code: "BAD_JSON", message: "Invalid JSON" } satisfies SWOError);
  }

  /** Delegate to controller to handle the message type */
  try {
    await onFrame(ws, rooms, meId, msg);
  } catch (e: any) {
    const code = e?.code ?? "WS_ERROR";
    const message = e?.message ?? "Error";
    safeSendJSON(ws, { type: "error", code, message } satisfies SWOError);
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

/* =========================================================== */
/* =========================================================== */
/* =========================================================== */

async function onFrame(ws: WebSocket, rooms: Rooms, meId: number, msg: AllWsIncoming) {
  try {
    switch (msg.type) {
      case "ping":
        return handleOFPing(ws, rooms, meId, msg);

      case "lobby_invite_send":
        return handleOFLobbyInviteSend(ws, rooms, meId, msg);

      case "lobby_invite_cancel":
        return handleOFLobbyInviteCancel(ws, rooms, meId, msg);
      case "lobby_invite_answer":
        return handleOFLobbyInviteAnswer(ws, rooms, meId, msg);
      case "lobby_set_settings":
        return handleOFLobbySetSettings(ws, rooms, meId, msg);
      case "lobby_ready":
        return handleOFLobbyReady(ws, rooms, meId, msg);
      case "lobby_leave":
        return handleOFLobbyLeave(ws, rooms, meId, msg);

      case "match_subscribe":
        return handleOFMatchSubscribe(ws, rooms, meId, msg);
      case "match_unsubscribe":
        return handleOFMatchUnsubscribe(ws, rooms, meId, msg);
      case "match_input":
        return handleOFMatchInput(ws, rooms, meId, msg);
      case "match_toggle_pause":
        return handleOFMatchTogglePause(ws, rooms, meId, msg);

      case "chat_subscribe":
        return handleOFChatSubscribe(ws, rooms, meId, msg);
      case "chat_unsubscribe":
        return handleOFChatUnsubscribe(ws, rooms, meId, msg);
      case "chat_typing":
        return handleOFChatTyping(ws, rooms, meId, msg);
      case "chat_send":
        return handleOFChatSend(ws, rooms, meId, msg);

      default:
        assertNever(msg);
    }
  } catch (e: any) {
    safeSendJSON(ws, { type: "error", code: e?.code ?? "WS_ERROR", message: e?.message ?? "Error" });
  }
}

function handleOFPing(ws: WebSocket, rooms: Rooms, meId: number, msg: SWIPing) {
  safeSendJSON(ws, { type: "pong", at: new Date().toISOString() } satisfies SWOPong);
}

/** -- LOBBY */
function handleOFLobbyInviteSend(ws: WebSocket, rooms: Rooms, meId: number, msg: LWIInviteSend) {}

function handleOFLobbyInviteCancel(ws: WebSocket, rooms: Rooms, meId: number, msg: LWIInviteCancel) {}

function handleOFLobbyInviteAnswer(ws: WebSocket, rooms: Rooms, meId: number, msg: LWIInviteAnswer) {}

function handleOFLobbySetSettings(ws: WebSocket, rooms: Rooms, meId: number, msg: LWISetSettings) {}

function handleOFLobbyReady(ws: WebSocket, rooms: Rooms, meId: number, msg: LWIReady) {}

function handleOFLobbyLeave(ws: WebSocket, rooms: Rooms, meId: number, msg: LWILeave) {}

/** -- MATCH */
function handleOFMatchSubscribe(ws: WebSocket, rooms: Rooms, meId: number, msg: MWISubscribe) {}

function handleOFMatchUnsubscribe(ws: WebSocket, rooms: Rooms, meId: number, msg: MWIUnsubscribe) {}

function handleOFMatchInput(ws: WebSocket, rooms: Rooms, meId: number, msg: MWIInput) {}

function handleOFMatchTogglePause(ws: WebSocket, rooms: Rooms, meId: number, msg: MWITogglePause) {}

/** -- CHAT */
function handleOFChatSubscribe(ws: WebSocket, rooms: Rooms, meId: number, msg: CWISubscribe) {
  const chatId = msg.chatId;
  if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");
  chatService.assertMembership(meId, chatId);
  rooms.subscribeChatWs(msg.chatId, ws);
}

function handleOFChatUnsubscribe(ws: WebSocket, rooms: Rooms, meId: number, msg: CWIUnsubscribe) {
  const chatId = msg.chatId;
  if (!Number.isInteger(chatId) || chatId <= 0) return;
  rooms.unsubscribeChatWs(chatId, ws);
}

function handleOFChatTyping(ws: WebSocket, rooms: Rooms, meId: number, msg: CWITyping) {
  const chatId = msg.chatId;
  if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");
  chatService.assertMembership(meId, chatId);
  rooms.broadcastToChat(chatId, {
    type: "chat_typing",
    chatId,
    userId: meId,
    isTyping: !!msg.isTyping,
    at: new Date().toISOString(),
  } satisfies CWOTyping);
}

function handleOFChatSend(ws: WebSocket, rooms: Rooms, meId: number, msg: CWISend) {
  if (!rateLimiterChats.allow(ws)) {
    return safeSendJSON(ws, { type: "error", code: "RATE_LIMIT", message: "Too many messages" });
  }

  const chatId = msg.chatId;
  if (!Number.isInteger(chatId) || chatId <= 0) throw err("CHAT_NOT_FOUND");

  const saved = chatService.sendChatMessage(meId, chatId, msg.body);
  chatService.assertMembership(meId, chatId);

  rooms.broadcastToChat(chatId, { type: "chat_message", chatId, message: saved } satisfies CWOMessage);
}
