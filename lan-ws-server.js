#!/usr/bin/env node
// lan-ws-server.js
//
// Petit serveur LAN WebSocket pour Pong
// Usage : node lan-ws-server.js
// Besoin : npm install ws
//
// Fonctionnalités :
// - Chaque client reçoit { type: "ready", userId }
// - Deux clients en attente sont automatiquement pairés en match
// - Envoi { type: "match_created", matchId, side, snapshot }
// - Simulation physique simple serveur-side (60 FPS)
// - Diffuse { type: "match_snapshot" }
// - Traite les inputs { type: "match_input" }
// - En cas de déco, envoie { type: "match_canceled" }

const WebSocket = require("ws");

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8081;
const PATH = "/api/ws";

const WORLD_W = 800;
const WORLD_H = 480;
const PADDLE_W = 16;
const PADDLE_H = 96;
const BALL_R = 8;
const PADDLE_SPEED = 420;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function rectCircleOverlap(rx, ry, rw, rh, cx, cy, cr) {
  const qx = clamp(cx, rx, rx + rw);
  const qy = clamp(cy, ry, ry + rh);
  const dx = cx - qx, dy = cy - qy;
  return dx * dx + dy * dy <= cr * cr;
}

let nextClientId = 1;
let nextMatchId = 1;
const waiting = [];
const matches = new Map();

const wss = new WebSocket.Server({ port: PORT, path: PATH });
console.log(`LAN WS server running on ws://0.0.0.0:${PORT}${PATH}`);

wss.on("connection", (ws) => {
  const clientId = nextClientId++;
  ws._cid = clientId;
  ws._matchId = null;
  ws._side = null;

  ws.send(JSON.stringify({ type: "ready", userId: clientId }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg) return;

    if (msg.type === "match_input") {
      const match = matches.get(msg.matchId);
      if (!match) return;
      const side = ws._side;
      if (!side) return;

      const isUp = msg.key === "up";
      const isDown = msg.key === "down";
      const input = match.inputs[side];
      if (msg.pressed) {
        if (isUp) input.up = true;
        if (isDown) input.down = true;
      } else {
        if (isUp) input.up = false;
        if (isDown) input.down = false;
      }
    }
  });

  ws.on("close", () => {
    const idx = waiting.indexOf(ws);
    if (idx !== -1) waiting.splice(idx, 1);

    if (ws._matchId != null) {
      const match = matches.get(ws._matchId);
      if (match) {
        const other = ws === match.left.ws ? match.right.ws : match.left.ws;
        if (other && other.readyState === WebSocket.OPEN) {
          other.send(
            JSON.stringify({
              type: "match_canceled",
              matchId: match.id,
              quitterId: ws._cid,
              quitterName: "opponent",
            })
          );
        }
        if (match.loop) clearInterval(match.loop);
        matches.delete(match.id);
      }
    }
  });

  waiting.push(ws);
  tryCreateMatch();
});

function tryCreateMatch() {
  while (waiting.length >= 2) {
    const a = waiting.shift();
    const b = waiting.shift();
    createMatch(a, b);
  }
}

function createMatch(aWs, bWs) {
  const id = nextMatchId++;

  const match = {
    id,
    left: { ws: aWs, id: aWs._cid, name: "Player A" },
    right: { ws: bWs, id: bWs._cid, name: "Player B" },
    inputs: { left: { up: false, down: false }, right: { up: false, down: false } },
    leftState: {
      paddle: { x: 10, y: (WORLD_H - PADDLE_H) / 2, width: PADDLE_W, height: PADDLE_H },
      vy: 0,
      score: 0,
    },
    rightState: {
      paddle: { x: WORLD_W - 10 - PADDLE_W, y: (WORLD_H - PADDLE_H) / 2, width: PADDLE_W, height: PADDLE_H },
      vy: 0,
      score: 0,
    },
    ball: {
      x: WORLD_W / 2,
      y: WORLD_H / 2,
      vx: (Math.random() > 0.5 ? 1 : -1) * 420,
      vy: (Math.random() > 0.5 ? 1 : -1) * 280,
      radius: BALL_R,
    },
    loop: null,
  };

  aWs._matchId = id;
  aWs._side = "left";
  bWs._matchId = id;
  bWs._side = "right";

  const snapshot = makeSnapshot(match);
  aWs.send(JSON.stringify({ type: "match_created", matchId: id, side: "left", snapshot }));
  bWs.send(JSON.stringify({ type: "match_created", matchId: id, side: "right", snapshot }));

  const tickMs = 1000 / 60;
  match.loop = setInterval(() => {
    stepMatch(match, tickMs / 1000);
    const snap = makeSnapshot(match);
    const msg = JSON.stringify({ type: "match_snapshot", matchId: id, snapshot: snap });
    [match.left.ws, match.right.ws].forEach((s) => {
      if (s && s.readyState === WebSocket.OPEN) s.send(msg);
    });
  }, tickMs);

  matches.set(id, match);
  console.log(`Created match #${id} between clients ${match.left.id} and ${match.right.id}`);
}

function makeSnapshot(m) {
  return {
    settings: { pointsToWin: 3, paddleHeight: PADDLE_H, freeMove: false, hostSide: "left", mode: "2d" },
    leftP: {
      x: m.leftState.paddle.x,
      y: m.leftState.paddle.y,
      vx: 0,
      vy: m.leftState.vy,
      score: m.leftState.score,
      id: m.left.id,
      name: m.left.name,
    },
    rightP: {
      x: m.rightState.paddle.x,
      y: m.rightState.paddle.y,
      vx: 0,
      vy: m.rightState.vy,
      score: m.rightState.score,
      id: m.right.id,
      name: m.right.name,
    },
    ball: { x: m.ball.x, y: m.ball.y, vx: m.ball.vx, vy: m.ball.vy },
    runtime: { phase: "playing", serverTimeMs: Date.now() },
  };
}

function stepMatch(m, dt) {
  ["left", "right"].forEach((side) => {
    const inp = m.inputs[side];
    const st = side === "left" ? m.leftState : m.rightState;
    let dy = 0;
    if (inp.up && !inp.down) dy = -1;
    if (inp.down && !inp.up) dy = 1;
    st.vy = dy * PADDLE_SPEED;
    st.paddle.y += st.vy * dt;
    st.paddle.y = clamp(st.paddle.y, 0, WORLD_H - st.paddle.height);
  });

  const b = m.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.y - b.radius < 0) { b.y = b.radius; b.vy = -b.vy; }
  if (b.y + b.radius > WORLD_H) { b.y = WORLD_H - b.radius; b.vy = -b.vy; }

  if (rectCircleOverlap(m.leftState.paddle.x, m.leftState.paddle.y, m.leftState.paddle.width, m.leftState.paddle.height, b.x, b.y, b.radius)) {
    if (b.vx < 0) b.vx = -b.vx * 1.03;
    b.x = m.leftState.paddle.x + m.leftState.paddle.width + b.radius;
  }
  if (rectCircleOverlap(m.rightState.paddle.x, m.rightState.paddle.y, m.rightState.paddle.width, m.rightState.paddle.height, b.x, b.y, b.radius)) {
    if (b.vx > 0) b.vx = -b.vx * 1.03;
    b.x = m.rightState.paddle.x - b.radius;
  }

  if (b.x < 0) {
    m.rightState.score++;
    resetBall(m, 1);
  } else if (b.x > WORLD_W) {
    m.leftState.score++;
    resetBall(m, -1);
  }
}

function resetBall(m, dir) {
  m.ball.x = WORLD_W / 2;
  m.ball.y = WORLD_H / 2;
  m.ball.vx = (dir >= 0 ? 1 : -1) * (360 + Math.random() * 200);
  m.ball.vy = (Math.random() > 0.5 ? 1 : -1) * (200 + Math.random() * 160);
}
