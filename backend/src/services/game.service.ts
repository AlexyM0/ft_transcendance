// backend/src/services/game.service.ts
import type { WebSocket } from "ws";
import { step } from "../utils/GamePhysics";
import { matchStateToSnapshot } from "../utils/GameSnapshot";
import type { MatchState, MatchRuntime, InputKeys, Side, MatchSettings, MatchSnapshot } from "../utils/GameTypes";
import { createGameOnlineState } from "../utils/GameOnlineState";
import { MWOSnapshot } from "../types/ws_types";
import { run } from "node:test";

/** Data structure */
const matches = new Map<number, MatchRuntime>();

/** Rates */
const SIM_DT = 1 / 240; // physics tick (s)
const SNAPSHOT_HZ = 20; // send to clients
const SNAPSHOT_EVERY = Math.round(1 / SIM_DT / SNAPSHOT_HZ); // 12

/* ========== Broadcast helpers ========== */
function safeSend(ws: WebSocket, payload: any) {
  try {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  } catch {}
}

function broadcastSnapshot(m: MatchRuntime) {
  const payload: MWOSnapshot = {
    type: "match_snapshot",
    matchId: m.matchId,
    snapshot: matchStateToSnapshot(m.state),
  };
  for (const ws of m.subs) safeSend(ws, payload);
}

/** Game */

export function createMatch(options: {
  matchId: number;
  leftUserId: number;
  rightUserId: number;
  me: { id: number; name: string; avatar_url: string | null };
  opp: { id: number; name: string; avatar_url: string | null };
  hostSide: Side;
  settings: MatchSettings;
}) {
  const state: MatchState = createGameOnlineState(options.matchId, options.me, options.opp, options.hostSide, options.settings);
  state.phase = state.phase ?? "paused";
  state.pauseCooldownAt = state.pauseCooldownAt ?? null;
  state.winner = null;

  const runtime: MatchRuntime = {
    matchId: options.matchId,
    state,
    players: {
      left: { userId: options.leftUserId, side: "left" },
      right: { userId: options.rightUserId, side: "right" },
    },
    subs: new Set(),
    raf: null,
    lastHr: process.hrtime.bigint(),
  };

  matches.set(options.matchId, runtime);
  startLoop(runtime);
  return runtime;
}

export function destroyMatch(matchId: number) {
  const m = matches.get(matchId);
  if (!m) return;
  if (m.raf) clearInterval(m.raf);
  matches.delete(matchId);
}

export function getSnapshot(matchId: number): MatchSnapshot | null {
  const m = matches.get(matchId);
  return m ? matchStateToSnapshot(m.state) : null;
}

export function subscribe(matchId: number, ws: WebSocket) {
  const m = matches.get(matchId);
  if (!m) return false;

  m.subs.add(ws);
  safeSend(ws, { type: "match_snapshot", matchId, snapshot: matchStateToSnapshot(m.state) } satisfies MWOSnapshot);
  return true;

  const onClose = () => {
    m?.subs.delete(ws);
    ws.off("close", onClose);
  };
  ws.on("close", onClose);

  return true;
}

export function unsubscribe(matchId: number, ws: WebSocket) {
  const m = matches.get(matchId);
  if (!m) return false;
  for (const sub of m.subs) if (sub === ws) m.subs.delete(sub);
  return true;
}

export function onInput(matchId: number, userId: number, key: InputKeys, pressed: boolean) {
  const m = matches.get(matchId);
  if (!m) return false;

  const side = userId === m.players.left.userId ? "left" : userId === m.players.right.userId ? "right" : null;
  if (!side) return;

  const p = side === "left" ? m.state.leftP : m.state.rightP;
  p.inputs[key] = pressed;
}

export function togglePause(matchId: number, userId: number) {
  console.log("Called 1");
  const m = matches.get(matchId);
  if (!m) return false;

  const s = m.state;
  if (s.phase === "playing") {
    console.log("Called 2");

    s.phase = "paused";
    s.pauseCooldownAt = null;
    broadcastSnapshot(m);
    return true;
  }
  if (s.phase === "paused") {
    console.log("Called 3");

    const pauseCooldownAt = Date.now() + 3000;
    s.phase = "countdown";
    s.pauseCooldownAt = pauseCooldownAt;
    broadcastSnapshot(m);
    return true;
  }
  return true;
}

/** --- Loop */
function startLoop(m: MatchRuntime) {
  let simAcc = 0;
  let steps = 0;

  m.raf = setInterval(() => {
    const nowHr = process.hrtime.bigint();
    const dt = Number(nowHr - m.lastHr) / 1e9;
    m.lastHr = nowHr;

    const s = m.state;
    if (s.phase === "countdown" && s.pauseCooldownAt) {
      if (Date.now() >= s.pauseCooldownAt) {
        s.phase = "playing";
        s.pauseCooldownAt = null;
        broadcastSnapshot(m);
      }
    }

    if (s.phase === "playing") {
      simAcc += dt;
      while (simAcc >= SIM_DT) {
        const scorer = step(m.state, SIM_DT);
        steps++;

        if (scorer) {
          const over = m.state.leftP.score >= m.state.pointsToWin || m.state.rightP.score >= m.state.pointsToWin;
          if (over) {
            const winner = m.state.leftP.score > m.state.rightP.score ? m.state.leftP : m.state.rightP;
            s.phase = "over";
            s.pauseCooldownAt = null;
            s.winner = { id: winner.id, name: winner.name };
            // Persist result (http/db) via the existing REST service
          } else {
            s.phase = "paused";
            s.pauseCooldownAt = null;
            s.winner = null;
          }
          broadcastSnapshot(m);
        }

        if (steps % SNAPSHOT_EVERY === 0) {
          broadcastSnapshot(m);
        }

        simAcc -= SIM_DT;
      }
    } else {
      // Even paused, send lower-rate snapshots so UI knows countdown/paused
    }
  }, Math.floor(1000 * SIM_DT));
}
