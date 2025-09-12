// backend/src/controllers/ws_controller.ts

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
  LWOInvite,
} from "../types/ws_types";
import { Rooms } from "../utils/ws_rooms";
import { RateLimiter } from "../utils/ws_rateLimiter";
import { err } from "../utils/errors";
import { MAX_JSON } from "../types/ws_types";

import * as chatService from "../services/chat.service";
import * as friendsModel from "../models/friends.model";
import * as lobbyService from "../services/lobby.service";
import * as gameService from "../services/game.service";

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

  const { userId, status } = lobbyService.onUserConnected(meId);
  rooms.broadcastToUsers([meId], { type: "user_status", userId, status });

  lobbyService.setLobbyEmitter(({ targets, payload }) => {
    rooms.broadcastToUsers(targets, payload);
  });

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

  lobbyService.onUserDisconnected(meId);

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
        return handleOFMatchCreated(ws, rooms, meId, msg);
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
function handleOFLobbyInviteSend(ws: WebSocket, rooms: Rooms, meId: number, msg: LWIInviteSend) {
  const res = lobbyService.inviteSend(meId, msg.to);
  if (!res) return;
  rooms.broadcastToUsers(res.targets, res.payload);
}

function handleOFLobbyInviteCancel(ws: WebSocket, rooms: Rooms, meId: number, msg: LWIInviteCancel) {
  const res = lobbyService.inviteCancel(meId, msg.inviteId);
  if (!res) return;
  rooms.broadcastToUsers(res.targets, res.payload);
}

function handleOFLobbyInviteAnswer(ws: WebSocket, rooms: Rooms, meId: number, msg: LWIInviteAnswer) {
  const resInvite = lobbyService.inviteAnswer(meId, msg.inviteId, msg.accept);
  if (!resInvite) return;

  if (resInvite.payload.type === "lobby_invite_response" && msg.accept) {
    const invFrom = resInvite.targets[0]!;
    const invTo = resInvite.targets[1]!;
    const resLobby = lobbyService.createLobby(invFrom, invTo);
    rooms.broadcastToUsers(resInvite.targets, resInvite.payload);
    rooms.broadcastToUsers(resLobby.targets, resLobby.payload);
  } else {
    rooms.broadcastToUsers(resInvite.targets, resInvite.payload);
  }
}

function handleOFLobbySetSettings(ws: WebSocket, rooms: Rooms, meId: number, msg: LWISetSettings) {
  const res = lobbyService.setSettings(msg.lobbyId, meId, msg.settings);
  if (!res) return;
  rooms.broadcastToUsers(res.targets, res.payload);
}

function handleOFMatchCreated(ws: WebSocket, rooms: Rooms, meId: number, msg: LWIReady) {
  const res = lobbyService.setReady(msg.lobbyId, meId, msg.ready);
  if (!res) return;
  for (const r of res) rooms.broadcastToUsers(r.targets, r.payload);
}

function handleOFLobbyLeave(ws: WebSocket, rooms: Rooms, meId: number, msg: LWILeave) {
  const res = lobbyService.leaveLobby(msg.lobbyId, meId);
  if (res) {
    rooms.broadcastToUsers(res.targets, res.payload);
  }
}

/** -- MATCH */
function handleOFMatchSubscribe(ws: WebSocket, rooms: Rooms, meId: number, msg: MWISubscribe) {
  const ok = gameService.subscribe(msg.matchId, ws);
  if (!ok) safeSendJSON(ws, { type: "error", code: "MATCH_NOT_FOUND", message: "No such match" } as SWOError);
}

function handleOFMatchUnsubscribe(ws: WebSocket, rooms: Rooms, meId: number, msg: MWIUnsubscribe) {
  gameService.unsubscribe(msg.matchId, ws);
}

function handleOFMatchInput(ws: WebSocket, rooms: Rooms, meId: number, msg: MWIInput) {
  if (!rateLimiterInputs.allow(ws)) {
    return safeSendJSON(ws, { type: "error", code: "RATE_LIMIT", message: "Too many inputs" } as SWOError);
  }
  gameService.onInput(msg.matchId, meId, msg.key, !!msg.pressed);
}

function handleOFMatchTogglePause(ws: WebSocket, rooms: Rooms, meId: number, msg: MWITogglePause) {
  gameService.togglePause(msg.matchId, meId);
}

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
