// backend/src/utils/GameTypes.ts
import type { WebSocket } from "ws";

export type Side = "left" | "right";
export type Points = 3 | 5 | 7 | 9;
export type PaddleSizeKey = "small" | "medium" | "large";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function rect(x: number, y: number, width: number, height: number) {
  return {
    x,
    y,
    width,
    height,
  } as Rect;
}

export type Circle = {
  x: number;
  y: number;
  radius: number;
};

export function circle(x: number, y: number, radius: number) {
  return {
    x,
    y,
    radius,
  } as Circle;
}

export type Velocity = {
  vx: number;
  vy: number;
};

export type Inputs = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type InputKeys = "up" | "down" | "left" | "right";

export type PlayerLight = {
  userId: number;
  side: Side;
};

export type PlayerState = {
  id: number;
  name: string;
  avatar_url: string | null;
  side: Side;
  paddle: Rect;
  velocity: Velocity;
  score: number;
  inputs: Inputs;
  // Precomputed bounds for free-move clamp
  leftBound: number;
  rightBound: number;
  color?: string; // frontend-only cosmetic
};

export type BallState = {
  area: Circle;
  velocity: Velocity;
  lastHit: "L" | "R" | null;
  sinceLastHitMs: number;
  samePaddleCooldownMs: number;
  acceleration: number;
};

export type BallSprite = {
  img: HTMLImageElement | null;
  ready: boolean;
  angle: number;
  spinPerSec: number;
};

export type MatchConfig = {
  worldW: number;
  worldH: number;
  paddleWidth: number;
  paddleHeights: Record<PaddleSizeKey, number>;
};

export type MatchSettings = {
  pointsToWin: Points;
  paddleHeight: PaddleSizeKey;
  freeMove: boolean;
  hostSide: Side;
};

export type MatchRuntime = {
  matchId: number;
  state: MatchState;
  players: { left: PlayerLight; right: PlayerLight };
  subs: Set<WebSocket>;
  raf: NodeJS.Timeout | null;
  lastHr: bigint;
};

export type MatchPhase = "playing" | "paused" | "countdown" | "over";

export type MatchState = {
  matchId: number;

  // Settings
  pointsToWin: number;
  paddleHeight: number;
  freeMove: boolean;

  // Players and ball
  leftP: PlayerState;
  rightP: PlayerState;
  ball: BallState;

  // Game runtime
  phase: MatchPhase;
  pauseCooldownAt?: number | null;
  winner?: { id: number; name: string } | null;
};

export type SettingsSnapshot = {
  pointsToWin: number;
  paddleHeight: number;
  freeMove: boolean;
};

export type PlayerSnapshot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  id: number;
  name: string;
  avatar_url: string | null;
};

export type BallSnapshot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type RuntimeSnapshot = {
  phase: MatchPhase;
  pauseCooldownAt?: number | null;
  winner?: { id: number; name: string } | null;
  serverTimeMs?: number;
};

export type MatchSnapshot = {
  settings: SettingsSnapshot;
  leftP: PlayerSnapshot;
  rightP: PlayerSnapshot;
  ball: BallSnapshot;
  runtime: RuntimeSnapshot;
};
