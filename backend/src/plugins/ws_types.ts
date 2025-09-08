// ws_types.ts
export type MatchSettingsWire = {
  pointsToWin: 3 | 5 | 7 | 9;
  paddleSize: "small" | "medium" | "large";
  freeMove: boolean;
  mode: "2d"; // 3d later
  hostSide: "left" | "right";
};

export function createDefaultSettingsWire(): MatchSettingsWire {
  return {
    pointsToWin: 3,
    paddleSize: "medium",
    freeMove: false,
    mode: "2d",
    hostSide: "left",
  } as MatchSettingsWire;
}

export type Incoming =
  | { type: "ping" }
  | { type: "subscribe"; chatId: number }
  | { type: "unsubscribe"; chatId: number }
  | { type: "typing"; chatId: number; isTyping: boolean }
  | { type: "send"; chatId: number; body: string }
  | { type: "invite_send"; to: number }
  | { type: "invite_cancel"; inviteId: number }
  | { type: "invite_answer"; inviteId: number; accept: boolean }
  | { type: "subscribe_match"; matchId: number }
  | { type: "unsubscribe_match"; matchId: number }
  | { type: "match_settings"; matchId: number; settings: MatchSettingsWire }
  | { type: "match_ready"; matchId: number; ready: boolean }
  | { type: "match_input"; matchId: number; key: "up" | "down" | "left" | "right"; pressed: boolean; at?: number }
  | { type: "match_toggle_pause"; matchId: number };

export type Outgoing =
  | { type: "ready"; userId: number }
  | { type: "message"; chatId: number; message: any }
  | { type: "typing"; chatId: number; userId: number; isTyping: boolean; at: string }
  | { type: "presence"; userId: number; online: boolean }
  | { type: "friend_request"; id: number; from_user_id: number; to_user_id: number }
  | { type: "error"; code: string; message: string }
  | { type: "pong"; at: string }
  | { type: "match_invite"; inviteId: number; from: number; to: number }
  | { type: "match_invite_canceled"; inviteId: number }
  | { type: "match_invite_response"; inviteId: number; accepted: boolean }
  | { type: "match_lobby"; matchId: number; hostId: number; guestId: number; settings: MatchSettingsWire; locked: boolean; ready: Record<number, boolean> }
  | { type: "match_ready_state"; matchId: number; userId: number; ready: boolean }
  | { type: "match_countdown"; matchId: number; seconds: number }
  | { type: "match_start"; matchId: number; seed: number }
  | {
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
    }
  | { type: "match_paused"; matchId: number }
  | { type: "match_resumed"; matchId: number }
  | { type: "match_over"; matchId: number; winnerId: number; scoreL: number; scoreR: number };
