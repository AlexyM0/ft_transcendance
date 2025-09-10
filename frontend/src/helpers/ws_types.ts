// src/helpers/ws_types.ts
import type { LobbySnapshot, UserStatus } from "./state_types";

/* ================================================================= */
/* ============================= SYSTEM ============================ */
/* ================================================================= */

/**
 *  System individual incoming WS messages types - one type defined per WS message type
 */
export type SWIReady = { type: "ready"; userId: number };
export type SWIUserStatus = { type: "user_status"; userId: number; status: UserStatus };
export type SWIPong = { type: "pong"; at: string };

/**
 *  System incoming WS messages types concatenated in one type
 */
export type SystemWsIncoming = SWIReady | SWIUserStatus | SWIPong;

/**
 *  System individual outgoing WS messages types - one type defined per WS message type
 */
export type SWOPing = { type: "ping" };

/**
 *  System outgoing WS messages types concatenated in one type
 */
export type SystemWsOutgoing = SWOPing;

/* ================================================================= */
/* ============================= LOBBY ============================= */
/* ================================================================= */

/**
 *  Lobby individual incoming WS messages types - one type defined per WS message type
 */
export type LWIInvite = { type: "lobby_invite"; inviteId: number; from: number; to: number };
export type LWIInviteCanceled = { type: "lobby_invite_canceled"; inviteId: number };
export type LWIInviteExpired = { type: "lobby_invite_expired"; inviteId: number };
export type LWIInviteResponse = { type: "lobby_invite_response"; inviteId: number; accepted: boolean };
export type LWIInviteError = { type: "lobby_invite_error"; code: "target_busy" | "already_invited" | "invite_not_pending" | "rate_limited"; message?: string };
export type LWIInviteSnapshot = { type: "lobby_snapshot"; matchId: number; lobbySnapshot: LobbySnapshot };
export type LWIReady = { type: "lobby_ready"; matchId: number; userId: number; ready: boolean };
export type LWIClosed = { type: "lobby_closed"; matchId: number };

/**
 *  Lobby incoming WS messages types concatenated in one type
 */
export type LobbyWsIncoming = LWIInvite | LWIInviteCanceled | LWIInviteExpired | LWIInviteResponse | LWIInviteError | LWIInviteSnapshot | LWIReady | LWIClosed;

/**
 *  Lobby individual outgoing WS messages types - one type defined per WS message type
 */
export type LWOInviteSend = { type: "lobby_invite_send"; to: number };
export type LWOInviteCancel = { type: "lobby_invite_cancel"; inviteId: number };
export type LWOInviteAnswer = { type: "lobby_invite_answer"; inviteId: number; accept: boolean };
export type LWOSetSettings = { type: "lobby_set_settings"; matchId: number; settings: any };
export type LWOReady = { type: "lobby_ready"; matchId: number; ready: boolean };
export type LWOLeave = { type: "lobby_leave"; matchId: number };

/**
 *  Lobby outgoing WS messages types concatenated in one type
 */
export type LobbyWsOutgoing = LWOInviteSend | LWOInviteCancel | LWOInviteAnswer | LWOSetSettings | LWOReady | LWOLeave;

/* ================================================================= */
/* ============================= MATCH ============================= */
/* ================================================================= */

/**
 *  Match individual incoming WS messages types - one type defined per WS message type
 */
export type MWICountDown = { type: "match_countdown"; matchId: number; seconds: number };
export type MWIStart = { type: "match_start"; matchId: number; seed: number };
export type MWISnapshot = {
  type: "match_snapshot";
  matchId: number;
  t: number;
  state: {
    ball: { x: number; y: number; vx: number; vy: number };
    left: { x: number; y: number; vx: number; vy: number; score: number; id: number; name: string };
    right: { x: number; y: number; vx: number; vy: number; score: number; id: number; name: string };
    target: number;
    freeMove: boolean;
    paddleH: number;
  };
};
export type MWIPaused = { type: "match_paused"; matchId: number };
export type MWIResumed = { type: "match_resumed"; matchId: number };
export type MWIOver = { type: "match_over"; matchId: number; winnerId: number; scoreL: number; scoreR: number };

/**
 *  Match incoming WS messages types concatenated in one type
 */
export type MatchWsIncoming = MWICountDown | MWIStart | MWISnapshot | MWIPaused | MWIResumed | MWIOver;

/**
 *  Match individual outgoing WS messages types - one type defined per WS message type
 */
export type MWOSubscribe = { type: "match_subscribe"; matchId: number };
export type MWOUnsubscribe = { type: "match_unsubscribe"; matchId: number };
export type MWOInput = { type: "match_input"; matchId: number; key: "up" | "down" | "left" | "right"; pressed: boolean; at: number };
export type MWOTogglePause = { type: "match_toggle_pause"; matchId: number };

/**
 *  Match outgoing WS messages types concatenated in one type
 */
export type MatchWsOutgoing = MWOSubscribe | MWOUnsubscribe | MWOInput | MWOTogglePause;

/* ================================================================= */
/* ============================= FRIENDS =========================== */
/* ================================================================= */

/**
 *  Friends individual incoming WS messages types - one type defined per WS message type
 */
export type FWIRequestSent = { type: "friend_request_sent"; id: number; from_user_id: number; to_user_id: number };
export type FWIRequestUpdated = { type: "friend_request_updated"; id: number; accepted: boolean };
export type FWIFriendDeleted = { type: "friend_deleted"; meId: number; friendId: number };

/**
 *  Friends incoming WS messages types concatenated in one type
 */
export type FriendsWsIncoming = FWIRequestSent | FWIRequestUpdated | FWIFriendDeleted;

/* ================================================================= */
/* ============================= CHAT ============================== */
/* ================================================================= */

/**
 *  Chat individual incoming WS messages types - one type defined per WS message type
 */
export type CWIMessage = { type: "chat_message"; chatId: number; message: any };
export type CWITyping = { type: "chat_typing"; chatId: number; userId: number; isTyping: boolean; at: string };
export type CWIPresence = { type: "presence"; userId: number; online: boolean };
export type CWIChatError = { type: "chat_error"; code: string; message: string };

/**
 *  Chat incoming WS messages types concatenated in one type
 */
export type ChatWsIncoming = CWIMessage | CWITyping | CWIPresence | CWIChatError;

/**
 *  Chat individual outgoing WS messages types - one type defined per WS message type
 */
export type CWOSubscribe = { type: "chat_subscribe"; chatId: number };
export type CWOUnsubscribe = { type: "chat_unsubscribe"; chatId: number };
export type CWOTyping = { type: "chat_typing"; chatId: number; isTyping: boolean };
export type CWOSend = { type: "chat_send"; chatId: number; body: string };

/**
 *  Chat outgoing WS messages types concatenated in one type
 */
export type ChatWsOutgoing = CWOSubscribe | CWOUnsubscribe | CWOTyping | CWOSend;

/* ================================================================= */
/* ============================= ALL =============================== */
/* ================================================================= */

/**
 *  All incoming WS messages types concatenated in one type
 */
export type AllWsIncoming = SystemWsIncoming | LobbyWsIncoming | MatchWsIncoming | FriendsWsIncoming | ChatWsIncoming;

/**
 *  All outgoing WS messages types concatenated in one type
 */
export type AllWsOutgoing = SystemWsOutgoing | LobbyWsOutgoing | MatchWsOutgoing | ChatWsOutgoing;

/* ================================================================= */
/* ============================= HELPERS =========================== */
/* ================================================================= */

// const LOBBY_TYPES = new Set<AllWsIncoming["type"]>(["lobby_invite", "lobby_invite_canceled", "lobby_invite_expired", "lobby_invite_response", "lobby_invite_error", "lobby_snapshot", "lobby_ready"]);

// const MATCH_TYPES = new Set<AllWsIncoming["type"]>(["match_countdown", "match_start", "match_paused", "match_resumed", "match_over"]);

// const CHAT_TYPES = new Set<AllWsIncoming["type"]>(["message", "typing", "friend_request"]);

// export function isMatchMsg(m: AllWsIncoming): m is MatchWsIncoming {
//   return MATCH_TYPES.has(m.type as any);
// }
// export function isChatMsg(m: AllWsIncoming): m is ChatWsIncoming {
//   return CHAT_TYPES.has(m.type as any);
// }
// export function isLobbyMsg(m: AllWsIncoming): m is LobbyWsIncoming {
//   return !isMatchMsg(m) && !isChatMsg(m);
// }
