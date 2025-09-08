// src/helpers/GameLocalDriver.ts
import { step } from "./GamePhysics";
import type { InputKeys, MatchState, Side } from "./GameTypes";
import { GameRenderer } from "./GameRenderer";

export function GameLocalDriver(
  renderer: GameRenderer,
  state: MatchState,
  options?: {
    onScore?: (leftScore: number, rightScore: number) => void;
    onOver?: (winnerId: number, leftScore: number, rightScore: number) => void;
  }
) {
  let last = performance.now();
  let raf = 0;

  let resumeAt: number | null = null;

  function tick(t: number) {
    const deltaTime = (t - last) / 1000;
    last = t;

    if (state.paused && resumeAt !== null) {
      const msLeft = resumeAt - t;
      const secLeft = Math.ceil(msLeft / 1000);
      renderer.setCountdown(msLeft > 0 ? Math.max(0, secLeft) : null);

      if (msLeft <= 0) {
        state.paused = false;
        resumeAt = null;
        renderer.setPaused(false);
        renderer.setCountdown(null);
      }
    }

    if (!state.paused) {
      let remaining = deltaTime;
      let sub = 1 / 240;
      while (remaining > 0) {
        const s = Math.min(sub, remaining);
        const scorer = step(state, s);
        if (scorer) {
          options?.onScore?.(state.leftP.score, state.rightP.score);
          state.paused = true;
          resumeAt = null;
          renderer.setPaused(true);
          renderer.setCountdown(null);
          if (state.leftP.score >= state.pointsToWin || state.rightP.score >= state.pointsToWin) {
            const winner = state.leftP.score > state.rightP.score ? state.leftP : state.rightP;
            renderer.setOver(winner.name);
            options?.onOver?.(winner.id, state.leftP.score, state.rightP.score);
          }
          break;
        }
        remaining -= s;
      }
    }
    renderer.draw(state);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(raf);
  }

  function input(side: Side, key: InputKeys, pressed: boolean) {
    const p = side === "left" ? state.leftP : state.rightP;
    p.inputs[key] = pressed;
  }

  function togglePause() {
    if (state.leftP.score >= state.pointsToWin || state.rightP.score >= state.pointsToWin) return;

    const now = performance.now();

    if (!state.paused) {
      state.paused = true;
      resumeAt = null;
      renderer.setPaused(true);
      renderer.setCountdown(null);
      return;
    }

    if (resumeAt !== null) {
      return;
    }

    resumeAt = now + 3000;
    renderer.setPaused(true);
    renderer.setCountdown(3);
  }

  return { start, stop, input, togglePause };
}
