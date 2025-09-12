// src/helpers/GameLocalDriver.ts
import { step } from "./GamePhysics";
import type { InputKeys, MatchState, Side } from "./GameTypes";
import { GameRenderer } from "./GameRenderer";

export function GameLocalDriver(
  renderer: GameRenderer,
  state: MatchState,
  options?: {
    onScore?: (leftScore: number, rightScore: number) => void;
    onOver?: (leftScore: number, rightScore: number) => void;
  }
) {
  let last = performance.now();
  let raf = 0;

  function syncOverlay() {
    switch (state.phase) {
      case "playing": {
        renderer.setPaused(false);
        renderer.setCountdown(null);
        renderer.setOver(null);
        break;
      }
      case "countdown": {
        const secs = state.pauseCooldownAt ? Math.max(0, Math.ceil((state.pauseCooldownAt - performance.now()) / 1000)) : 0;
        renderer.setPaused(true);
        renderer.setCountdown(secs);
        renderer.setOver(null);
      }
      case "paused": {
        renderer.setPaused(true);
        renderer.setCountdown(null);
        renderer.setOver(null);
      }
      case "over": {
        renderer.setPaused(true);
        renderer.setCountdown(null);
        renderer.setOver(state.winner?.name ?? null);
      }
    }
  }

  function tick(t: number) {
    const deltaTime = (t - last) / 1000;
    last = t;

    if (state.phase === "countdown" && state.pauseCooldownAt) {
      if (t >= state.pauseCooldownAt) {
        state.phase = "playing";
        state.pauseCooldownAt = undefined;
        syncOverlay();
      } else {
        const secs = Math.max(0, Math.ceil((state.pauseCooldownAt - t) / 1000));
        renderer.setCountdown(secs);
      }
    }

    if (state.phase === "playing") {
      let remaining = deltaTime;
      const sub = 1 / 240;
      while (remaining > 0) {
        const s = Math.min(sub, remaining);
        const scorer = step(state, s);
        if (scorer) {
          options?.onScore?.(state.leftP.score, state.rightP.score);
          const over = state.leftP.score >= state.pointsToWin || state.rightP.score >= state.pointsToWin;
          if (over) {
            const winner = state.leftP.score > state.rightP.score ? state.leftP : state.rightP;
            state.phase = "over";
            state.winner = { id: winner.id, name: winner.name };
            options?.onOver?.(state.leftP.score, state.rightP.score);
          } else {
            state.phase = "paused";
          }
          syncOverlay();
          break;
        }
        remaining -= s;
      }
    }

    renderer.draw(state);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    syncOverlay();
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
    if (state.phase === "over") return;
    if (state.phase === "playing") {
      state.phase = "paused";
      state.pauseCooldownAt = undefined;
      syncOverlay();
      return;
    }
    if (state.phase === "paused") {
      state.phase = "countdown";
      state.pauseCooldownAt = performance.now() + 3000;
      syncOverlay();
    }
  }

  return { start, stop, input, togglePause };
}
