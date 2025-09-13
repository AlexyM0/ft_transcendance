// src/helpers/GameSnapshot.ts
import type { BallSnapshot, MatchState, PlayerSnapshot, SettingsSnapshot, MatchSnapshot, RuntimeSnapshot, Inputs, Side } from "./GameTypes";
import { WORLD_H } from "./GameConstants";

/** Only used by server */
export function matchStateToSnapshot(s: MatchState): MatchSnapshot {
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

  const runtimeSnapshot: RuntimeSnapshot = {
    phase: s.phase,
    pauseCooldownAt: s.pauseCooldownAt ?? null,
    winner: s.winner ?? null,
    serverTimeMs: Date.now(),
  };

  return {
    ball: ballSnapshot,
    leftP: leftPSnapshot,
    rightP: rightPSnapshot,
    settings: settingsSnapshot,
    runtime: runtimeSnapshot,
  } as MatchSnapshot;
}

export function applySnapshotToMatch(s: MatchState, w: MatchSnapshot) {
  // Ball
  s.ball.area.x = w.ball.x;
  s.ball.area.y = w.ball.y;
  s.ball.velocity.vx = w.ball.vx;
  s.ball.velocity.vy = w.ball.vy;

  // Left player
  s.leftP.paddle.x = w.leftP.x;
  s.leftP.paddle.y = w.leftP.y;
  s.leftP.velocity.vx = w.leftP.vx;
  s.leftP.velocity.vy = w.leftP.vy;
  s.leftP.score = w.leftP.score;
  s.leftP.id = w.leftP.id;
  s.leftP.name = w.leftP.name;
  s.leftP.avatar_url = w.leftP.avatar_url;

  // Right player
  s.rightP.paddle.x = w.rightP.x;
  s.rightP.paddle.y = w.rightP.y;
  s.rightP.velocity.vx = w.rightP.vx;
  s.rightP.velocity.vy = w.rightP.vy;
  s.rightP.score = w.rightP.score;
  s.rightP.id = w.rightP.id;
  s.rightP.name = w.rightP.name;
  s.rightP.avatar_url = w.rightP.avatar_url;

  // Settings
  s.pointsToWin = w.settings.pointsToWin;
  s.paddleHeight = w.settings.paddleHeight;
  s.freeMove = w.settings.freeMove;

  // Runtime
  s.phase = w.runtime.phase;
  s.pauseCooldownAt = w.runtime.pauseCooldownAt ?? null;
  s.winner = w.runtime.winner ?? null;
}

// --- Add near your imports ---
export type TimedSnap = { t: number; snap: MatchSnapshot };

const INTERP_DELAY_MS = 100; // small playback delay to absorb jitter
const MAX_EXTRAP_MS = 100; // clamp extrapolation for safety

export function pushSnapshot(snap: MatchSnapshot, snaps: TimedSnap[]) {
  const t = snap.runtime.serverTimeMs ?? Date.now(); // fallback if serverTime not present
  // keep ordered, drop old
  snaps.push({ t, snap });
  while (snaps.length > 10) snaps.shift();
}

// Scratch state reused every frame to avoid GC churn

// Lerp helpers
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function copyFromSnap(dst: MatchState, src: MatchSnapshot) {
  // positions/velocities/scores
  dst.leftP.paddle.x = src.leftP.x;
  dst.leftP.paddle.y = src.leftP.y;
  dst.leftP.velocity.vx = src.leftP.vx;
  dst.leftP.velocity.vy = src.leftP.vy;
  dst.leftP.score = src.leftP.score;
  dst.leftP.id = src.leftP.id;
  dst.leftP.name = src.leftP.name;
  dst.leftP.avatar_url = src.leftP.avatar_url;

  dst.rightP.paddle.x = src.rightP.x;
  dst.rightP.paddle.y = src.rightP.y;
  dst.rightP.velocity.vx = src.rightP.vx;
  dst.rightP.velocity.vy = src.rightP.vy;
  dst.rightP.score = src.rightP.score;
  dst.rightP.id = src.rightP.id;
  dst.rightP.name = src.rightP.name;
  dst.rightP.avatar_url = src.rightP.avatar_url;

  dst.ball.area.x = src.ball.x;
  dst.ball.area.y = src.ball.y;
  dst.ball.velocity.vx = src.ball.vx;
  dst.ball.velocity.vy = src.ball.vy;

  // settings (rarely change)
  dst.pointsToWin = src.settings.pointsToWin;
  dst.paddleHeight = src.settings.paddleHeight;
  dst.freeMove = src.settings.freeMove;

  // runtime meta drives overlay
  dst.phase = src.runtime.phase;
  dst.pauseCooldownAt = src.runtime.pauseCooldownAt ?? null;
  dst.winner = src.runtime.winner ?? null;
}

export function copyRuntimeFromSnap(dst: MatchState, src: MatchSnapshot) {
  dst.leftP.score = src.leftP.score;
  dst.leftP.id = src.leftP.id;
  dst.leftP.name = src.leftP.name;
  dst.leftP.avatar_url = src.leftP.avatar_url;
  dst.rightP.score = src.rightP.score;
  dst.rightP.id = src.rightP.id;
  dst.rightP.name = src.rightP.name;
  dst.rightP.avatar_url = src.rightP.avatar_url;

  dst.pointsToWin = src.settings.pointsToWin;
  dst.paddleHeight = src.settings.paddleHeight;
  dst.freeMove = src.settings.freeMove;

  dst.phase = src.runtime.phase;
  dst.pauseCooldownAt = src.runtime.pauseCooldownAt ?? null;
  dst.winner = src.runtime.winner ?? null;
}

function integrateBallBounceY(y0: number, vy0: number, tTargetSec: number, radius: number) {
  // reflect between [top,bottom] inclusive
  const top = radius;
  const bottom = WORLD_H - radius;

  let y = y0;
  let vy = vy0;
  let remaining = tTargetSec;

  // small safety break to avoid infinite loops
  for (let i = 0; i < 3 && remaining > 0; i++) {
    if (vy === 0) {
      // no vertical motion; just advance time
      return { y, vy };
    }

    const tToBoundary =
      vy < 0
        ? (top - y) / vy // vy negative → numerator <= 0 gives positive time
        : (bottom - y) / vy; // vy positive

    if (tToBoundary > 0 && tToBoundary <= remaining) {
      // hit boundary within remaining time: move to boundary, reflect, continue
      y += vy * tToBoundary;
      vy = -vy;
      remaining -= tToBoundary;
      // clamp exactly onto boundary to avoid drift
      y = vy > 0 ? top : bottom;
    } else {
      // no boundary hit within remaining time: advance and finish
      y += vy * remaining;
      remaining = 0;
    }
  }
  return { y, vy };
}

function blendStatesBounceAwareBall(dst: MatchState, A: TimedSnap, B: TimedSnap, alpha: number) {
  const As = A.snap,
    Bs = B.snap;

  // paddles + ball.x → standard linear blend
  dst.leftP.paddle.x = lerp(As.leftP.x, Bs.leftP.x, alpha);
  dst.leftP.paddle.y = lerp(As.leftP.y, Bs.leftP.y, alpha);
  dst.rightP.paddle.x = lerp(As.rightP.x, Bs.rightP.x, alpha);
  dst.rightP.paddle.y = lerp(As.rightP.y, Bs.rightP.y, alpha);
  dst.ball.area.x = lerp(As.ball.x, Bs.ball.x, alpha);

  // ball.y with reflections
  const dtSec = Math.max(0.000001, (B.t - A.t) / 1000);
  const tTarget = alpha * dtSec;
  const r = dst.ball.area.radius; // known locally

  const yInt = integrateBallBounceY(As.ball.y, As.ball.vy, tTarget, r);
  dst.ball.area.y = yInt.y;
  // optionally set vy to interpolated/instant value; not necessary for visuals
  dst.ball.velocity.vx = lerp(As.ball.vx, Bs.ball.vx, alpha);
  dst.ball.velocity.vy = yInt.vy;

  // copy discrete/meta from A (authoritative)
  copyRuntimeFromSnap(dst, As);
}

export function pickRenderSnapshot(nowMs: number, state: MatchState, snaps: TimedSnap[], drawState: MatchState) {
  const target = nowMs - INTERP_DELAY_MS;
  let i = 0;
  while (i < snaps.length && snaps[i].t < target) i++;
  const A = snaps[i - 1];
  const B = snaps[i];

  if (A && B && A.snap.runtime.phase === "playing" && B.snap.runtime.phase === "playing") {
    const span = B.t - A.t || 1;
    const alpha = Math.min(1, Math.max(0, (target - A.t) / span));
    // USE bounce-aware blend for ball:
    blendStatesBounceAwareBall(drawState, A, B, alpha);
    return true;
  }

  if (A) {
    copyFromSnap(drawState, A.snap);
    return true;
  }
  if (B) {
    copyFromSnap(drawState, B.snap);
    return true;
  }

  Object.assign(drawState, state);
  return false;
}

export function maybeExtrapolateBallOnly(nowMs: number, snaps: TimedSnap[], drawState: MatchState) {
  // If target is newer than the newest snapshot, extrapolate a tiny bit using velocity
  if (snaps.length === 0) return;
  const latest = snaps[snaps.length - 1]!;
  const dt = Math.min(MAX_EXTRAP_MS, nowMs - latest.t) / 1000;
  const s = latest.snap;
  if (s.runtime.phase !== "playing") return; // don't extrapolate when not playing

  drawState.ball.area.x = s.ball.x + s.ball.vx * dt;
  drawState.ball.area.y = s.ball.y + s.ball.vy * dt;
}

const PADDLE_SPEED = 800; // must match server applyInputs()
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function predictMyPaddle(state: MatchState, mySide: Side, localInputs: Inputs, dt: number) {
  if (state.phase !== "playing") return;

  const me = mySide === "left" ? state.leftP : state.rightP;

  const ox = me.paddle.x;
  const oy = me.paddle.y;

  if (localInputs.up) me.paddle.y -= PADDLE_SPEED * dt;
  if (localInputs.down) me.paddle.y += PADDLE_SPEED * dt;

  if (state.freeMove) {
    if (localInputs.left) me.paddle.x -= PADDLE_SPEED * dt;
    if (localInputs.right) me.paddle.x += PADDLE_SPEED * dt;
    me.paddle.x = clamp(me.paddle.x, me.leftBound, me.rightBound);
  }
  me.paddle.y = clamp(me.paddle.y, 0, WORLD_H - me.paddle.height);

  me.velocity.vx = (me.paddle.x - ox) / dt;
  me.velocity.vy = (me.paddle.y - oy) / dt;
}
