// backend/src/types/ws_types.ts
import type { LobbySnapshot, MatchSettingsSnapshot, Side, UserStatus } from "../types/state_types";
import { MatchSnapshot, MatchState } from "../utils/GameTypes";

export const MAX_JSON = 4 * 1024;

// ===========================================================================
// ===========================================================================
// ===========================================================================
// ===========================================================================

/* ================================================================= */
/* ============================= SYSTEM ============================ */
/* ================================================================= */

/**
 *  System individual outgoing WS messages types - one type defined per WS message type
 */
export type SWOReady = { type: "ready"; userId: number };
export type SWOUserStatus = { type: "user_status"; userId: number; status: UserStatus };
export type SWOPong = { type: "pong"; at: string };
export type SWOError = { type: "error"; code: string; message: string };

/**
 *  System outgoing WS messages types concatenated in one type
 */
export type SystemWsOutgoing = SWOReady | SWOUserStatus | SWOPong | SWOError;

/**
 *  System individual incoming WS messages types - one type defined per WS message type
 */
export type SWIPing = { type: "ping" };

/**
 *  System incoming WS messages types concatenated in one type
 */
export type SystemWsIncoming = SWIPing;

/* ================================================================= */
/* ============================= LOBBY ============================= */
/* ================================================================= */

/**
 *  Lobby individual outgoing WS messages types - one type defined per WS message type
 */
export type LWOInvite = { type: "lobby_invite"; inviteId: number; from: number; to: number };
export type LWOInviteCanceled = { type: "lobby_invite_canceled"; inviteId: number };
export type LWOInviteExpired = { type: "lobby_invite_expired"; inviteId: number };
export type LWOInviteResponse = { type: "lobby_invite_response"; inviteId: number; accepted: boolean };
export type LWOInviteError = { type: "lobby_invite_error"; code: "target_busy" | "already_invited" | "invite_not_pending" | "rate_limited"; message?: string };
export type LWOLobbySnapshot = { type: "lobby_snapshot"; lobbyId: number; lobbySnapshot: LobbySnapshot };
export type LWOClosed = { type: "lobby_closed"; lobbyId: number };

/**
 *  Lobby outgoing WS messages types concatenated in one type
 */
export type LobbyWsOutgoing = LWOInvite | LWOInviteCanceled | LWOInviteExpired | LWOInviteResponse | LWOInviteError | LWOLobbySnapshot | LWOClosed;

/**
 *  Lobby individual incoming WS messages types - one type defined per WS message type
 */
export type LWIInviteSend = { type: "lobby_invite_send"; from: number; to: number };
export type LWIInviteCancel = { type: "lobby_invite_cancel"; inviteId: number };
export type LWIInviteAnswer = { type: "lobby_invite_answer"; inviteId: number; accept: boolean };
export type LWISetSettings = { type: "lobby_set_settings"; lobbyId: number; settings: MatchSettingsSnapshot };
export type LWIReady = { type: "lobby_ready"; lobbyId: number; ready: boolean };
export type LWILeave = { type: "lobby_leave"; lobbyId: number };

/**
 *  Lobby incoming WS messages types concatenated in one type
 */
export type LobbyWsIncoming = LWIInviteSend | LWIInviteCancel | LWIInviteAnswer | LWISetSettings | LWIReady | LWILeave;

/* ================================================================= */
/* ============================= MATCH ============================= */
/* ================================================================= */

/**
 *  Match individual outgoing WS messages types - one type defined per WS message type
 */
export type MWOCreated = { type: "match_created"; matchId: number; side: Side; snapshot: MatchSnapshot };
export type MWOSnapshot = { type: "match_snapshot"; matchId: number; snapshot: MatchSnapshot };

/**
 *  Match outgoing WS messages types concatenated in one type
 */
export type MatchWsOutgoing = MWOCreated | MWOSnapshot;

/**
 *  Match individual incoming WS messages types - one type defined per WS message type
 */
export type MWISubscribe = { type: "match_subscribe"; matchId: number };
export type MWIUnsubscribe = { type: "match_unsubscribe"; matchId: number };
export type MWIInput = { type: "match_input"; matchId: number; key: "up" | "down" | "left" | "right"; pressed: boolean };
export type MWITogglePause = { type: "match_toggle_pause"; matchId: number };

/**
 *  Match incoming WS messages types concatenated in one type
 */
export type MatchWsIncoming = MWISubscribe | MWIUnsubscribe | MWIInput | MWITogglePause;

/* ================================================================= */
/* ============================= FRIENDS =========================== */
/* ================================================================= */

/**
 *  Friends individual outgoing WS messages types - one type defined per WS message type
 */
export type FWORequestSent = { type: "friend_request_sent"; id: number; from_user_id: number; to_user_id: number };
export type FWORequestUpdated = { type: "friend_request_updated"; id: number; accepted: boolean };
export type FWOFriendDeleted = { type: "friend_deleted"; meId: number; friendId: number };

/**
 *  Friends outgoing WS messages types concatenated in one type
 */
export type FriendsWsOutgoing = FWORequestSent | FWORequestUpdated | FWOFriendDeleted;

/* ================================================================= */
/* ============================= CHAT ============================== */
/* ================================================================= */

/**
 *  Chat individual outgoing WS messages types - one type defined per WS message type
 */
export type CWOMessage = { type: "chat_message"; chatId: number; message: any };
export type CWOTyping = { type: "chat_typing"; chatId: number; userId: number; isTyping: boolean; at: string };
export type CWOPresence = { type: "presence"; userId: number; online: boolean };
export type CWOChatError = { type: "chat_error"; code: string; message: string };

/**
 *  Chat outgoing WS messages types concatenated in one type
 */
export type ChatWsOutgoing = CWOMessage | CWOTyping | CWOPresence | CWOChatError;

/**
 *  Chat individual incoming WS messages types - one type defined per WS message type
 */
export type CWISubscribe = { type: "chat_subscribe"; chatId: number };
export type CWIUnsubscribe = { type: "chat_unsubscribe"; chatId: number };
export type CWITyping = { type: "chat_typing"; chatId: number; isTyping: boolean };
export type CWISend = { type: "chat_send"; chatId: number; body: string };

/**
 *  Chat incoming WS messages types concatenated in one type
 */
export type ChatWsIncoming = CWISubscribe | CWIUnsubscribe | CWITyping | CWISend;

/* ================================================================= */
/* ============================= ALL =============================== */
/* ================================================================= */

/**
 *  All incoming WS messages types concatenated in one type
 */
export type AllWsIncoming = SystemWsIncoming | LobbyWsIncoming | MatchWsIncoming | ChatWsIncoming;

/**
 *  All outgoing WS messages types concatenated in one type
 */
export type AllWsOutgoing = SystemWsOutgoing | LobbyWsOutgoing | MatchWsOutgoing | FriendsWsOutgoing | ChatWsOutgoing;
