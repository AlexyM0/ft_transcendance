// src/services/matches.runtime.service.ts
import { broadcastToMatch } from "../../utils/ws_rooms";
import { type MatchSettingsWire, createDefaultSettingsWire } from "../ws_types";
import { closeLobby, getLobby } from "./matches.lobby.service";

const WORLD_W = 2000;
const WORLD_H = (WORLD_W * 9) / 16;
const paddleWidth = 12;
const paddleHeights = { small: 100, medium: 150, large: 200 } as const;

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Velocity = {
  vx: number;
  vy: number;
};

type Circle = {
  x: number;
  y: number;
  radius: number;
};

type Inputs = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

type Player = {
  id: number;
  name: string;
  paddle: Rect;
  velocity: Velocity;
  score: number;
  inputs: Inputs;
  side: "left" | "right";
  leftBound: number;
  rightBound: number;
};

type Ball = {
  area: Circle;
  velocity: Velocity;
  lastHit: "L" | "R" | null;
  sinceMs: number;
  cooldownMs: number;
};

type Runtime = {
  matchId: number;
  hostId: number;
  guestId: number;
  paused: boolean;
  target: number;
  freeMove: boolean;
  paddleHeight: number;
  left: Player;
  right: Player;
  ball: Ball;
  simTimer: NodeJS.Timeout | null;
  snapTimer: NodeJS.Timeout | null;
  pauseCooldownAt: number;
};

const matches = new Map<number, Runtime>();

function clamp(n: number, floor: number, ceiling: number) {
  return Math.max(floor, Math.min(ceiling, n));
}

function rect(x: number, y: number, width: number, height: number) {
  return {
    x,
    y,
    width,
    height,
  } as Rect;
}

function circle(x: number, y: number, radius: number) {
  return {
    x,
    y,
    radius,
  } as Circle;
}

function circleRectHit(circle: Circle, rect: Rect) {
  const qx = clamp(circle.x, rect.x, rect.x + rect.width);
  const qy = clamp(circle.y, rect.y, rect.y + rect.height);
  let dx = circle.x - qx;
  let dy = circle.y - qy;
  const dist2 = dx * dx + dy * dy;
  if (dist2 <= circle.radius * circle.radius) {
    if (dx === 0 && dy === 0) {
      const left = Math.abs(circle.x - circle.radius - rect.x);
      const right = Math.abs(rect.x + rect.width - (circle.x + circle.radius));
      const top = Math.abs(circle.y - circle.radius - rect.y);
      const bottom = Math.abs(rect.y + rect.height - (circle.y + circle.radius));
      const m = Math.min(left, right, top, bottom);

      if (m === left) return { hit: true, nx: -1, ny: 0, pen: left };
      if (m === right) return { hit: true, nx: 1, ny: 0, pen: right };
      if (m === top) return { hit: true, nx: 0, ny: -1, pen: top };
      return { hit: true, nx: 0, ny: 1, pen: bottom };
    }
    const dist = Math.sqrt(dist2);
    return { hit: true, nx: dx / dist, ny: dy / dist, pen: circle.radius - dist };
  }
  return { hit: false };
}

function resolve(ball: Ball, paddle: Rect, paddleV: Velocity) {
  const hit: any = circleRectHit(ball.area, paddle);
  if (!hit.hit) return false;

  ball.area.x += hit.nx * hit.pen;
  ball.area.y += hit.ny * hit.pen;

  const vdotn = ball.velocity.vx * hit.nx + ball.velocity.vy * hit.ny;
  ball.velocity.vx = ball.velocity.vx - (1 + 0.9) * vdotn * hit.nx;
  ball.velocity.vy = ball.velocity.vy - (1 + 0.9) * vdotn * hit.ny;

  ball.velocity.vx += (paddleV.vx ?? 0) * 0.25;
  ball.velocity.vy += (paddleV.vy ?? 0) * 0.25;
  ball.velocity.vx *= 1.03;
  ball.velocity.vy *= 1.03;
  return true;
}

function newRuntime(matchId: number, hostId: number, guestId: number, settings: MatchSettingsWire, names: { host: string; guest: string }): Runtime {
  const meLeft = settings.hostSide === "left";
  const leftId = meLeft ? hostId : guestId;
  const rightId = meLeft ? guestId : hostId;
  const leftName = meLeft ? names.host : names.guest;
  const rightName = meLeft ? names.guest : names.host;

  const paddleHeight = paddleHeights[settings.paddleSize];
  const margin = 18;
  const midY = (WORLD_H - paddleHeight) / 2;
  const half = WORLD_W / 2;
  const marginFreeMove = 10;

  const left: Player = {
    id: leftId,
    name: leftName,
    paddle: {
      x: margin,
      y: midY,
      width: paddleWidth,
      height: paddleHeight,
    },
    velocity: {
      vx: 0,
      vy: 0,
    },
    score: 0,
    side: "left",
    inputs: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    leftBound: marginFreeMove,
    rightBound: half - marginFreeMove - paddleWidth,
  };

  const right: Player = {
    id: rightId,
    name: rightName,
    paddle: {
      x: WORLD_W - margin - paddleWidth,
      y: midY,
      width: paddleWidth,
      height: paddleHeight,
    },
    velocity: {
      vx: 0,
      vy: 0,
    },
    score: 0,
    side: "right",
    inputs: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    leftBound: half + marginFreeMove,
    rightBound: WORLD_W - marginFreeMove - paddleWidth,
  };

  const ball: Ball = {
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
    sinceMs: 1e9,
    cooldownMs: 1000,
  };

  return {
    matchId,
    hostId,
    guestId,
    paused: true,
    pauseCooldownAt: 0,
    target: settings.pointsToWin,
    freeMove: settings.freeMove,
    paddleHeight,
    left,
    right,
    ball,
    simTimer: null,
    snapTimer: null,
  } as Runtime;
}

function applyInputs(player: Player, deltaTime: number, freeMove: boolean) {
  const velocity = 800;
  const ox = player.paddle.x;
  const oy = player.paddle.y;
  if (player.inputs.up) player.paddle.y -= velocity * deltaTime;
  if (player.inputs.down) player.paddle.y += velocity * deltaTime;
  if (freeMove) {
    if (player.inputs.left) player.paddle.x -= velocity * deltaTime;
    if (player.inputs.right) player.paddle.x += velocity * deltaTime;
    player.paddle.x = clamp(player.paddle.x, player.leftBound, player.rightBound);
  }
  player.paddle.y = clamp(player.paddle.y, 0, WORLD_H - player.paddle.height);
  player.velocity.vx = (player.paddle.x - ox) / deltaTime;
  player.velocity.vy = (player.paddle.y - oy) / deltaTime;
}

function step(runtime: Runtime, deltaTime: number) {
  const { left, right, ball } = runtime;

  applyInputs(left, deltaTime, runtime.freeMove);
  applyInputs(right, deltaTime, runtime.freeMove);

  ball.area.x += ball.velocity.vx * deltaTime;
  ball.area.y += ball.velocity.vy * deltaTime;
  ball.sinceMs += deltaTime * 1000;

  // Walls collision
  if (ball.area.y - ball.area.radius < 0) {
    ball.area.y = ball.area.radius;
    ball.velocity.vy *= -1;
  }
  if (ball.area.y + ball.area.radius > WORLD_H) {
    ball.area.y = WORLD_H - ball.area.radius;
    ball.velocity.vy *= -1;
  }

  // Paddles collision
  let hit = false;
  if (ball.lastHit !== "L" || ball.sinceMs >= ball.cooldownMs) {
    if (resolve(ball, left.paddle, left.velocity)) {
      ball.lastHit = "L";
      ball.sinceMs = 0;
      hit = true;
    }
  }
  if (!hit && (ball.lastHit !== "R" || ball.sinceMs >= ball.cooldownMs)) {
    if (resolve(ball, right.paddle, right.velocity)) {
      ball.lastHit = "R";
      ball.sinceMs = 0;
      hit = true;
    }
  }

  // Scoring
  let scorer: 1 | 2 | null = null;
  if (ball.area.x < 0) scorer = 2;
  if (ball.area.x > WORLD_W) scorer = 1;
  if (scorer) {
    (scorer === 1 ? left : right).score++;
    ball.area.x = WORLD_W / 2;
    ball.area.y = WORLD_H / 2;
    ball.velocity.vx = (Math.random() > 0.5 ? 1 : -1) * 500;
    ball.velocity.vy = (Math.random() > 0.5 ? 1 : -1) * 320;
    ball.lastHit = null;
    ball.sinceMs = 1e9;

    // Pause between points is handled by lobby/UI via countdown. We keep sim running
  }
}

export function startRuntime(matchId: number, hostId: number, guestId: number, settings: MatchSettingsWire, names: { host: string; guest: string }) {
  const runtime = newRuntime(matchId, hostId, guestId, settings, names);
  matches.set(matchId, runtime);

  let seconds = 3;
  const tick = setInterval(() => {
    broadcastToMatch(matchId, { type: "match_countdown", matchId, seconds });
    if (--seconds < 0) {
      clearInterval(tick);
      runtime.paused = false;
      broadcastToMatch(matchId, { type: "match_start", matchId, seed: Math.floor(Math.random() * 1e9) });
    }
  }, 1000);

  // 120 Hz sim
  runtime.simTimer = setInterval(() => {
    if (runtime.paused) return;
    const stepDeltaTime = 1 / 240;

    // 4 substeps ~60Hz visible
    for (let t = 0; t < 4; t++) step(runtime, stepDeltaTime);

    // Check win
    if (runtime.left.score >= runtime.target || runtime.right.score >= runtime.target) {
      const winnerId = runtime.left.score > runtime.right.score ? runtime.left.id : runtime.right.id;
      broadcastToMatch(matchId, { type: "match_over", matchId, winnerId, scoreL: runtime.left.score, scoreR: runtime.right.score });
      stopRuntime(matchId);
    }
  }, 1000 / 120);

  // 30 Hz snapshots
  runtime.snapTimer = setInterval(() => {
    const state = {
      ball: {
        x: runtime.ball.area.x,
        y: runtime.ball.area.y,
        vx: runtime.ball.velocity.vx,
        vy: runtime.ball.velocity.vy,
      },
      left: {
        x: runtime.left.paddle.x,
        y: runtime.left.paddle.y,
        vx: runtime.left.velocity.vx,
        vy: runtime.left.velocity.vy,
        score: runtime.left.score,
        id: runtime.left.id,
        name: runtime.left.name,
      },
      right: {
        x: runtime.right.paddle.x,
        y: runtime.right.paddle.y,
        vx: runtime.right.velocity.vx,
        vy: runtime.right.velocity.vy,
        score: runtime.right.score,
        id: runtime.right.id,
        name: runtime.right.name,
      },

      target: runtime.target,
      freeMove: runtime.freeMove,
      paddleH: runtime.paddleHeight,
    };

    broadcastToMatch(matchId, { type: "match_snapshot", matchId, t: Date.now(), state });
  }, 1000 / 30);
}

export function stopRuntime(matchId: number) {
  const runtime = matches.get(matchId);
  if (!runtime) return;

  if (runtime.simTimer) clearInterval(runtime.simTimer);
  if (runtime.snapTimer) clearInterval(runtime.snapTimer);

  matches.delete(matchId);
  closeLobby(matchId);
}

export function onInput(matchId: number, userId: number, key: "up" | "down" | "left" | "right", pressed: boolean) {
  const runtime = matches.get(matchId);
  if (!runtime) return;

  const player = runtime.left.id === userId ? runtime.left : runtime.right.id === userId ? runtime.right : null;
  if (!player) return;

  player.inputs[key] = pressed;
}

export function togglePause(matchId: number) {
  const runtime = matches.get(matchId);
  if (!runtime) return;

  const now = Date.now();
  if (now - runtime.pauseCooldownAt < 700) return;
  runtime.pauseCooldownAt = now;

  if (!runtime.paused) {
    runtime.paused = true;
    broadcastToMatch(matchId, { type: "match_paused", matchId });
  } else {
    let seconds = 3;
    const timer = setInterval(() => {
      broadcastToMatch(matchId, { type: "match_countdown", matchId, seconds });
      if (--seconds < 0) {
        clearInterval(timer);
        runtime.paused = false;
        broadcastToMatch(matchId, { type: "match_resumed", matchId });
      }
    }, 1000);
  }
}
