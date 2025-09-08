// src/helpers/GamePhysics.ts
import { WORLD_W, WORLD_H } from "./GameConstants";
import type { Rect, Circle, Velocity, PlayerState, MatchState } from "./GameTypes";

function clamp(n: number, floor: number, ceiling: number) {
  return Math.max(floor, Math.min(ceiling, n));
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

function resolveCollision(ball: MatchState["ball"], paddle: Rect, paddleV: Velocity) {
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

function applyInputs(player: PlayerState, deltaTime: number, freeMove: boolean) {
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

export function step(s: MatchState, deltaTime: number) {
  const { leftP, rightP, ball } = s;

  applyInputs(leftP, deltaTime, s.freeMove);
  applyInputs(rightP, deltaTime, s.freeMove);

  ball.area.x += ball.velocity.vx * deltaTime;
  ball.area.y += ball.velocity.vy * deltaTime;
  ball.sinceLastHitMs += deltaTime * 1000;

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
  if (ball.lastHit !== "L" || ball.sinceLastHitMs >= ball.samePaddleCooldownMs) {
    if (resolveCollision(ball, leftP.paddle, leftP.velocity)) {
      ball.lastHit = "L";
      ball.sinceLastHitMs = 0;
      hit = true;
    }
  }
  if (!hit && (ball.lastHit !== "R" || ball.sinceLastHitMs >= ball.samePaddleCooldownMs)) {
    if (resolveCollision(ball, rightP.paddle, rightP.velocity)) {
      ball.lastHit = "R";
      ball.sinceLastHitMs = 0;
      hit = true;
    }
  }

  // Scoring
  let scorer: 1 | 2 | null = null;
  if (ball.area.x < 0) scorer = 2;
  if (ball.area.x > WORLD_W) scorer = 1;
  if (scorer) {
    (scorer === 1 ? leftP : rightP).score++;
    ball.area.x = WORLD_W / 2;
    ball.area.y = WORLD_H / 2;
    ball.velocity.vx = (Math.random() > 0.5 ? 1 : -1) * 500;
    ball.velocity.vy = (Math.random() > 0.5 ? 1 : -1) * 320;
    ball.lastHit = null;
    ball.sinceLastHitMs = 1e9;

    // Pause between points is handled by lobby/UI via countdown. We keep sim running
  }
  return scorer;
}
