// src/helpers/GameLocalState.ts
import { WORLD_W, WORLD_H, PADDLE_WIDTH } from "./GameConstants";
import type { MatchState, PlayerState, BallState, MatchSnapshot } from "./GameTypes";

export function createGameOnlineState(matchId: number, snapshot: MatchSnapshot): MatchState {
  const paddleHeight = snapshot.settings.paddleHeight;
  const margin = 18;
  const midY = (WORLD_H - paddleHeight) / 2;
  const half = WORLD_W / 2;
  const marginFreeMove = 10;

  const leftP: PlayerState = {
    id: snapshot.leftP.id,
    name: snapshot.leftP.name,
    avatar_url: snapshot.leftP.avatar_url,
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
    id: snapshot.rightP.id,
    name: snapshot.rightP.name,
    avatar_url: snapshot.rightP.avatar_url,
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
    pointsToWin: snapshot.settings.pointsToWin,
    paddleHeight: paddleHeight,
    freeMove: snapshot.settings.freeMove,
    leftP,
    rightP,
    ball,
    phase: snapshot.runtime.phase,
    pauseCooldownAt: snapshot.runtime.pauseCooldownAt ?? null,
    winner: snapshot.runtime.winner ?? null,
  };

  return matchState;
}
