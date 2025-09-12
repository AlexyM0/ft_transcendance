// backend/src/services/game.service.ts
import type { RawData, WebSocket } from "ws";
import { step } from "../utils/GamePhysics";
import { matchStateToSnapshot } from "../utils/GameSnapshot";
import type { MatchState, MatchRuntime, InputKeys, Side, MatchSettings } from "../utils/GameTypes";
import { createGameOnlineState } from "../utils/GameOnlineState";
import { MWOSnapshot } from "../types/ws_types";

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

function broadcast(m: MatchRuntime, payload: any) {
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
  const matchState: MatchState = createGameOnlineState(options.matchId, options.me, options.opp, options.hostSide, options.settings);
  const matchRuntime: MatchRuntime = {
    matchId: options.matchId,
    state: matchState,
    players: {
      left: { userId: options.leftUserId, side: "left" },
      right: { userId: options.rightUserId, side: "right" },
    },
    subs: new Set(),
    raf: null,
    lastHr: process.hrtime.bigint(),
    paused: true,
    resumeAtMs: null,
  };

  matches.set(options.matchId, matchRuntime);
  startLoop(matchRuntime);
  return matchRuntime;
}

export function destroyMatch(matchId: number) {
  const m = matches.get(matchId);
  if (!m) return;
  if (m.raf) clearInterval(m.raf);
  matches.delete(matchId);
}

export function subscribe(matchId: number, ws: WebSocket) {
  const m = matches.get(matchId);
  if (!m) return false;

  m.subs.add(ws);
  safeSend(ws, { type: "match_snapshot", matchId, snapshot: matchStateToSnapshot(m.state) } satisfies MWOSnapshot);
  return true;
}

export function unsubscribe(matchId: number, ws: WebSocket) {
  const m = matches.get(matchId);
  if (!m) return false;
  for (const sub of m.subs) if (sub === ws) m.subs.delete(sub);
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
  console.log("aaaaaa");
  const m = matches.get(matchId);
  if (!m) return false;

  if (!m.paused) {
    m.paused = true;
    m.resumeAtMs = null;
    broadcast(m, { type: "match_paused", matchId: m.matchId } satisfies MWOPaused);
    return;
  }

  if (m.resumeAtMs !== null) return;
  m.resumeAtMs = Date.now() + 3000;
  broadcast(m, { type: "match_countdown", matchId: m.matchId, seconds: 3 } satisfies MWOCountDown);
}

/** --- Loop */
function startLoop(m: MatchRuntime) {
  let simAcc = 0;
  let steps = 0;

  m.raf = setInterval(() => {
    const nowHr = process.hrtime.bigint();
    const dt = Number(nowHr - m.lastHr) / 1e9;
    m.lastHr = nowHr;

    if (m.paused && m.resumeAtMs !== null) {
      const msLeft = m.resumeAtMs - Date.now();
      if (msLeft <= 0) {
        m.paused = false;
        m.resumeAtMs = null;
        broadcast(m, { type: "match_resumed", matchId: m.matchId } satisfies MWOResumed);
      } else {
        // optionally broadcast int countdown changes; not every tick
      }
    }

    if (!m.paused) {
      simAcc += dt;
      while (simAcc >= SIM_DT) {
        const scorer = step(m.state, SIM_DT);
        steps++;

        if (scorer) {
          broadcast(m, { type: "match_score", matchId: m.matchId, left: m.state.leftP.score, right: m.state.rightP.score } satisfies MWOScore);
          m.paused = true;
          m.resumeAtMs = null;

          const over = m.state.leftP.score >= m.state.pointsToWin || m.state.rightP.score >= m.state.pointsToWin;
          if (over) {
            const winner = m.state.leftP.score > m.state.rightP.score ? m.state.leftP.name : m.state.rightP.name;
            broadcast(m, { type: "match_over", matchId: m.matchId, winner, scoreL: m.state.leftP.score, scoreR: m.state.rightP.score } satisfies MWOOver);
            // Persist result (http/db) via the existing REST service
          } else {
            // Auto-countdown or wait for host toggle
          }
        }

        if (steps % SNAPSHOT_EVERY === 0) {
          broadcast(m, { type: "match_snapshot", matchId: m.matchId, snapshot: matchStateToSnapshot(m.state) } satisfies MWOSnapshot);
        }

        simAcc -= SIM_DT;
      }
    } else {
      // Even paused, send lower-rate snapshots so UI knows countdown/paused
    }
  }, Math.floor(1000 * SIM_DT));
}
