// src/helpers/GameSnapshot.ts
import type { BallSnapshot, MatchState, PlayerSnapshot, SettingsSnapshot, SnapshotWire } from "./GameTypes";

export function MatchStateToSnapshot(s: MatchState): SnapshotWire {
  const ballSnapshot: BallSnapshot = {
    x: s.ball.area.x,
    y: s.ball.area.y,
    vx: s.ball.velocity.vx,
    vy: s.ball.velocity.vy,
  };

  const leftPSnapshot: PlayerSnapshot = {
    x: s.leftP.paddle.x,
    y: s.leftP.paddle.y,
    vx: s.leftP.velocity.vx,
    vy: s.leftP.velocity.vy,
    score: s.leftP.score,
    id: s.leftP.id,
    name: s.leftP.name,
  };

  const rightPSnapshot: PlayerSnapshot = {
    x: s.rightP.paddle.x,
    y: s.rightP.paddle.y,
    vx: s.rightP.velocity.vx,
    vy: s.rightP.velocity.vy,
    score: s.rightP.score,
    id: s.rightP.id,
    name: s.rightP.name,
  };

  const settingsSnapshot: SettingsSnapshot = {
    pointsToWin: s.pointsToWin,
    freeMove: s.freeMove,
    paddleHeight: s.paddleHeight,
  };

  return {
    ball: ballSnapshot,
    leftP: leftPSnapshot,
    rightP: rightPSnapshot,
    settings: settingsSnapshot,
  } as SnapshotWire;
}

export function ApplySnapshotToMatch(s: MatchState, w: SnapshotWire) {
  s.ball.area.x = w.ball.x;
  s.ball.area.y = w.ball.y;
  s.ball.velocity.vx = w.ball.vx;
  s.ball.velocity.vy = w.ball.vy;

  s.leftP.paddle.x = w.leftP.x;
  s.leftP.paddle.y = w.leftP.y;
  s.leftP.velocity.vx = w.leftP.vx;
  s.leftP.velocity.vy = w.leftP.vy;
  s.leftP.score = w.leftP.score;
  s.leftP.id = w.leftP.id;
  s.leftP.name = w.leftP.name;

  s.rightP.paddle.x = w.rightP.x;
  s.rightP.paddle.y = w.rightP.y;
  s.rightP.velocity.vx = w.rightP.vx;
  s.rightP.velocity.vy = w.rightP.vy;
  s.rightP.score = w.rightP.score;
  s.rightP.id = w.rightP.id;
  s.rightP.name = w.rightP.name;

  s.pointsToWin = w.settings.pointsToWin;
  s.freeMove = w.settings.freeMove;
  s.paddleHeight = w.settings.paddleHeight;
}
