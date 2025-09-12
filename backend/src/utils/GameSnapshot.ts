// src/helpers/GameSnapshot.ts
import type { BallSnapshot, MatchRuntime, PlayerSnapshot, SettingsSnapshot, MatchSnapshot, RuntimeSnapshot } from "./GameTypes";

export function matchStateToSnapshot(m: MatchRuntime): MatchSnapshot {
  const s = m.state;
  const isCountdown = m.paused && m.resumeAtMs !== null;

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
    avatar_url: s.leftP.avatar_url,
  };

  const rightPSnapshot: PlayerSnapshot = {
    x: s.rightP.paddle.x,
    y: s.rightP.paddle.y,
    vx: s.rightP.velocity.vx,
    vy: s.rightP.velocity.vy,
    score: s.rightP.score,
    id: s.rightP.id,
    name: s.rightP.name,
    avatar_url: s.rightP.avatar_url,
  };

  const settingsSnapshot: SettingsSnapshot = {
    pointsToWin: s.pointsToWin,
    freeMove: s.freeMove,
    paddleHeight: s.paddleHeight,
  };

  const runtimeSnapshot : RuntimeSnapshot = {
	phase : !m.paused ? "playing" : isCountdown ? "countdown" : "paused",
	countdownMs: isCountdown ? Math.max(0, m.resumeAtMs! - Date.now()) : undefined,
	winner: 
  }

  return {
    ball: ballSnapshot,
    leftP: leftPSnapshot,
    rightP: rightPSnapshot,
    settings: settingsSnapshot,
	runtime: runtimeSnapshot,
  } as MatchSnapshot;
}

export function applySnapshotToMatch(s: MatchState, w: MatchSnapshot) {
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
  s.leftP.avatar_url = w.leftP.avatar_url;

  s.rightP.paddle.x = w.rightP.x;
  s.rightP.paddle.y = w.rightP.y;
  s.rightP.velocity.vx = w.rightP.vx;
  s.rightP.velocity.vy = w.rightP.vy;
  s.rightP.score = w.rightP.score;
  s.rightP.id = w.rightP.id;
  s.rightP.name = w.rightP.name;
  s.rightP.avatar_url = w.rightP.avatar_url;

  s.pointsToWin = w.settings.pointsToWin;
  s.freeMove = w.settings.freeMove;
  s.paddleHeight = w.settings.paddleHeight;
}
