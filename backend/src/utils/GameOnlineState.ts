// src/helpers/GameLocalState.ts
import { WORLD_W, WORLD_H, PADDLE_WIDTH, PADDLE_HEIGHTS } from "./GameConstants";
import type { MatchSettings, MatchState, PlayerState, BallState, Side } from "./GameTypes";

const margin = 18;

export function createGameOnlineState(
  matchId: number,
  me: { id: number; name: string; avatar_url: string | null },
  opp: { id: number; name: string; avatar_url: string | null },
  mySide: Side,
  settings: MatchSettings
): MatchState {
  const paddleHeight = PADDLE_HEIGHTS[settings.paddleHeight];
  const midY = (WORLD_H - paddleHeight) / 2;
  const half = WORLD_W / 2;
  const marginFreeMove = 10;

  const leftIsMe = mySide === "left";
  const leftP: PlayerState = {
    id: leftIsMe ? me.id : opp.id,
    name: leftIsMe ? me.name : opp.name,
    avatar_url: leftIsMe ? me.avatar_url : opp.avatar_url,
    side: "left" as const,
    paddle: {
      x: margin,
      y: midY,
      width: PADDLE_WIDTH,
      height: paddleHeight,
    },
    velocity: {
      vx: 0,
      vy: 0,
    },
    score: 0,
    inputs: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    leftBound: marginFreeMove,
    rightBound: half - marginFreeMove - PADDLE_WIDTH,
    color: "#e2f7e1",
  };

  const rightP: PlayerState = {
    id: leftIsMe ? opp.id : me.id,
    name: leftIsMe ? opp.name : me.name,
    avatar_url: leftIsMe ? opp.avatar_url : me.avatar_url,
    side: "right" as const,
    paddle: {
      x: WORLD_W - margin - PADDLE_WIDTH,
      y: midY,
      width: PADDLE_WIDTH,
      height: paddleHeight,
    },
    velocity: {
      vx: 0,
      vy: 0,
    },
    score: 0,
    inputs: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    leftBound: half + marginFreeMove,
    rightBound: WORLD_W - marginFreeMove - PADDLE_WIDTH,
    color: "#fde2e2",
  };

  const ball: BallState = {
    area: {
      x: WORLD_W / 2,
      y: WORLD_H / 2,
      radius: 40,
    },
    velocity: {
      vx: (Math.random() > 0.5 ? 1 : -1) * 500,
      vy: (Math.random() > 0.5 ? 1 : -1) * 320,
    },
    lastHit: null,
    sinceLastHitMs: 1e9,
    samePaddleCooldownMs: 1000,
    acceleration: 1.03,
  };

  const matchState: MatchState = {
    matchId: matchId,
    pointsToWin: settings.pointsToWin,
    paddleHeight: paddleHeight,
    freeMove: settings.freeMove,
    leftP,
    rightP,
    ball,
    phase: "paused",
    pauseCooldownAt: null,
    winner: null,
  };

  return matchState;
}

export function resetPlayerPositions(state: MatchState) {
  const midY = (WORLD_H - state.paddleHeight) / 2;

  state.leftP.paddle.x = margin;
  state.leftP.paddle.y = midY;
  state.rightP.paddle.x = WORLD_W - margin - PADDLE_WIDTH;
  state.rightP.paddle.y = midY;
}
