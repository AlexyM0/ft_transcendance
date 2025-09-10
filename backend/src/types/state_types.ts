// src/helpers/state_types.ts

export type UserRow = { id: number; pseudo: string; avatar_url: string | null };
export type PublicUser = { id: number; pseudo: string; avatar_url: string | null };

export type UserStatus = "online" | "in_lobby" | "playing" | "offline" | "dnd";

export type MatchRow = {
  id: number;
  p1_id: number;
  p1_pseudo: string;
  p1_avatar_url: string | null;
  p2_id: number;
  p2_pseudo: string;
  p2_avatar_url: string | null;
  status: "pending" | "finished" | "canceled";
  winner_id: number | null;
  score_p1: number | null;
  score_p2: number | null;
  created_at: string;
};

export type Points = 3 | 5 | 7 | 9;
export type PaddleSizeKey = "small" | "medium" | "large";
export type Side = "left" | "right";

export type Settings = {
  me: UserRow;
  opponent: UserRow | null;
  pointsToWin: Points;
  paddleSize: PaddleSizeKey;
  mySide: Side;
  freeMove: boolean;
  matchId: number | null;
};

export type MatchSettingsSnapshot = {
  pointsToWin: 3 | 5 | 7 | 9;
  paddleSize: "small" | "medium" | "large";
  freeMove: boolean;
  hostSide: "left" | "right";
};

export type Invite = {
  id: number;
  from: number;
  to: number;
  status: "pending" | "canceled" | "declined" | "accepted";
};

export type LobbySnapshot = {
  matchId: number;
  hostId: number;
  guestId: number;
  settings: MatchSettingsSnapshot;
  locked: boolean;
  ready: Record<number, boolean>;
};

export type LobbyState = {
  meId: number | null;
  opponent: PublicUser | null; // UI-selected opponent + desired pre-lobby settings */;
  settings: MatchSettingsSnapshot; // UI-selected opponent + desired pre-lobby settings */;
  outgoing: {
    inviteId: number | null; // null until server echoes "match_invite"
    to: number | null; // recipient user id
    since: number; // timestamp (ms)
    cancelRequestedBeforeAck: boolean; // user pressed "Cancel" before inviteId ack
  } | null; // Outgoing invite we sent (may not have an inviteId yet)
  inboxQueue: Array<{ inviteId: number; from: number }>; // Incoming invites: we keep a queue and show one decision UI at a time
  activeIncoming: { inviteId: number; from: number } | null;
  userStatus: Record<number, UserStatus>; // Live user status map (server is authoritative)
  lobbySnapshot: LobbySnapshot | null; // Lobby snapshot from server when formed
  loading: boolean;
  error: string | null;
};
