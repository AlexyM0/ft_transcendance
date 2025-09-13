// src/views/MatchLocalView.ts
import { domElem as h, mount } from "../ui/DomElement";
import { GameRenderer } from "../helpers/GameRenderer";
import type { InputKeys, MatchSnapshot, MatchState, Side } from "../helpers/GameTypes";
import { Avatar } from "../ui/Avatar";
import { Realtime } from "../helpers/ws";
import type { AllWsIncoming, MWOInput, MWOTogglePause } from "../helpers/ws_types";
import { maybeExtrapolateBallOnly, pickRenderSnapshot, predictMyPaddle, pushSnapshot, type TimedSnap } from "../helpers/GameSnapshot";
import { createGameOnlineState } from "../helpers/GameOnlineState";
import * as http from "../api/http";
import { auth } from "../store/auth.store";

export function MatchOnlineView(root: HTMLElement) {
  /** -- Config settings from PlayView */
  const raw = sessionStorage.getItem("play:online:current");
  if (!raw) {
    location.hash = "/player/chooser";
    return () => {};
  }

  const { matchId, side, snapshot } = JSON.parse(raw) as { matchId: number; side: Side; snapshot: MatchSnapshot };
  const mySide: Side = side;
  const state: MatchState = createGameOnlineState(matchId, snapshot);

  /** -- DOM elements */
  const viewWrap = h("div", { class: "flex flex-col gap-10 items-center" });
  const canvasHeaderWrap = h("div", { class: "w-full" });
  const header = h("div", { class: "h-16 px-4 border-b border-emerald-100 bg-emerald-50/70 flex items-center justify-between" });
  const canvasWwrap = h("div", { class: "flex-1 min-h-0 grid place-items-center bg-emerald-50" });
  const canvas = h("canvas", { class: "block rounded-md shadow border border-emerald-100 bg-white" }) as HTMLCanvasElement;
  const quitBtn = h("button", { class: "px-6 py-2 bg-emerald-700 rounded rounded-lg flex flex-row gap-4 items-center text-white text-lg font-semibold hover:bg-emerald-400" });
  const quitIcon = h("i", { class: "fa-solid fa-xmark" });
  const quitText = h("span", { text: "Quit game" });
  quitBtn.append(quitIcon, quitText);

  canvasWwrap.appendChild(canvas);
  canvasHeaderWrap.append(header, canvasWwrap);
  viewWrap.append(canvasHeaderWrap, quitBtn);
  root.append(viewWrap);

  /** -- Quit btn behaviour */
  async function quitLocal() {
    sessionStorage.removeItem("play:online:current");
    location.hash = "/play";
  }

  quitBtn.addEventListener("click", async () => {
    if (state.phase === "over") {
      await quitLocal();
      return;
    }
    try {
      await http.putRequest(`/api/matches/${matchId}/cancel/online`);
    } catch (e) {
    } finally {
      await quitLocal();
    }
  });

  /** -- Game Settings */
  const renderer = new GameRenderer(canvasWwrap, canvas, header);
  renderer.setBallSprite("/ball.png");

  /** -- DOM Elements - Header content set with game settings */
  const leftInfoWrap = h("div", { class: "flex items-center gap-2" });
  const leftInfoAvatar = Avatar(snapshot.leftP.avatar_url, 28);
  const leftInfoName = h("span", { class: "font-bold", text: snapshot.leftP.name });
  const leftInfoScore = h("span", { class: "ml-2 font-bold text-lg text-emerald-700 bg-white rounded-lg min-w-10 text-center shadow", text: String(state.leftP.score) });
  mount(leftInfoWrap, leftInfoAvatar, leftInfoName, leftInfoScore);

  const rightInfoWrap = h("div", { class: "flex items-center gap-2" });
  const rightInfoScore = h("span", { class: "mr-2 font-bold text-lg text-emerald-700 bg-white rounded-lg min-w-10 text-center shadow", text: String(state.rightP.score) });
  const rightInfoName = h("span", { class: "font-bold", text: snapshot.rightP.name });
  const rightInfoAvatar = Avatar(snapshot.rightP.avatar_url, 28);
  mount(rightInfoWrap, rightInfoScore, rightInfoName, rightInfoAvatar);

  mount(header, leftInfoWrap, rightInfoWrap);

  /** -- Overlay sync derived from unified MatchState */
  const syncOverlayFromState = () => {
    switch (state.phase) {
      case "playing":
        renderer.setPaused(false);
        renderer.setCountdown(null);
        renderer.setOver(null);
        break;
      case "countdown": {
        const secs = state.pauseCooldownAt ? Math.max(0, Math.ceil((state.pauseCooldownAt - Date.now()) / 1000)) : 0;
        renderer.setPaused(true);
        renderer.setCountdown(secs);
        renderer.setOver(null);
        break;
      }
      case "paused":
        renderer.setPaused(true);
        renderer.setCountdown(null);
        renderer.setOver(null);
        break;
      case "over":
        renderer.setPaused(true);
        renderer.setCountdown(null);
        renderer.setOver(state.winner ? `Winner ${state.winner?.name ?? ""}` : null);
        sessionStorage.removeItem("play:online:current");
        break;
    }
  };

  /** Drawing smooth */
  const snaps: TimedSnap[] = []; // tiny buffer; we’ll keep ~2–5 items max
  const drawState: MatchState = JSON.parse(JSON.stringify(state)) as MatchState;
  const INTERP_DELAY_MS = 100; // small playback delay to absorb jitter
  const MAX_EXTRAP_MS = 100; // clamp extrapolation for safety

  /** -- Game driver */
  const rt = new Realtime("/api/ws");
  const stop = rt.on((msg: AllWsIncoming) => {
    if (msg.type === "ready") {
      rt.send({ type: "match_subscribe", matchId });
      return;
    }

    if (msg.type === "match_snapshot" && msg.matchId === matchId) {
      pushSnapshot(msg.snapshot, snaps);
      leftInfoScore.textContent = String(msg.snapshot.leftP.score);
      rightInfoScore.textContent = String(msg.snapshot.rightP.score);

      const r = msg.snapshot.runtime;
      if (r.phase === "playing") {
        renderer.setPaused(false);
        renderer.setCountdown(null);
        renderer.setOver(null);
      } else if (r.phase === "countdown") {
        const secs = r.pauseCooldownAt ? Math.max(0, Math.ceil((r.pauseCooldownAt - Date.now()) / 1000)) : 0;
        renderer.setPaused(true);
        renderer.setCountdown(secs);
        renderer.setOver(null);
      } else if (r.phase === "paused") {
        renderer.setPaused(true);
        renderer.setCountdown(null);
        renderer.setOver(null);
      } else {
        // r.phase === "over"
        state.phase = "over";
        state.winner = r.winner;
        renderer.setPaused(true);
        renderer.setCountdown(null);
        renderer.setOver(state.winner ? `Winner ${state.winner?.name ?? ""}` : null);
        sessionStorage.removeItem("play:local:current");
      }
    } else if (msg.type === "match_canceled" && msg.matchId === matchId) {
      if (msg.quitterId !== auth.get().meId) {
        renderer.setPaused(true);
        renderer.setCountdown(null);
        renderer.setOver(`${msg.quitterName} left the game`);

        window.removeEventListener("keydown", keyDownHandler);
        window.removeEventListener("keyup", keyUpHandler);

        quitText.textContent = "Back to menu";
      }
    }
  });

  rt.connect();

  /** -- Keyboard mapping to inputs */
  const leftKeys = { up: "w", down: "s", left: "a", right: "d" };
  const rightKeys = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
  const findKey = (map: Record<string, string>, key: string) => (Object.entries(map).find(([, k]) => k === key)?.[0] as keyof typeof map | undefined) ?? undefined;
  const localInputs: Record<InputKeys, boolean> = { up: false, down: false, left: false, right: false };

  const keyDownHandler = (e: KeyboardEvent) => {
    if (e.key === " " && !e.repeat) {
      rt.send({ type: "match_toggle_pause", matchId } satisfies MWOTogglePause);
      e.preventDefault();
      return;
    }

    const map = mySide === "left" ? leftKeys : rightKeys;
    const k = findKey(map as any, e.key);
    if (k) {
      localInputs[k as InputKeys] = true;
      rt.send({ type: "match_input", matchId, key: k as "up" | "down" | "left" | "right", pressed: true } satisfies MWOInput);
      e.preventDefault();
    }
  };

  const keyUpHandler = (e: KeyboardEvent) => {
    const map = mySide === "left" ? leftKeys : rightKeys;
    const k = findKey(map as any, e.key);
    if (k) {
      localInputs[k as InputKeys] = false;
      rt.send({ type: "match_input", matchId, key: k as "up" | "down" | "left" | "right", pressed: false } satisfies MWOInput);
      e.preventDefault();
    }
  };

  window.addEventListener("keydown", keyDownHandler, { passive: false });
  window.addEventListener("keyup", keyUpHandler, { passive: false });

  // Initial paint reflects bootstrap snapshot
  syncOverlayFromState();
  renderer.draw(state);

  // Draw loop just for smooth visuals between snapshots

  let raf = 0;
  let lastFrameMs = performance.now();

  const drawLoop = () => {
    const wallNowMs = Date.now();
    const frameNow = performance.now();
    let dtSec = (frameNow - lastFrameMs) / 1000;
    lastFrameMs = frameNow;

    // Clamp dt to avoid huge jumps when tab was hidden or frame hiccups
    if (!Number.isFinite(dtSec)) dtSec = 0;
    dtSec = Math.min(Math.max(dtSec, 0), 0.05); // 0..50ms

    const had = pickRenderSnapshot(wallNowMs, state, snaps, drawState);
    if (!had) {
      // nothing to interpolate yet; draw authoritative state
      renderer.draw(state);
    } else {
      // optional tiny extrapolation if we've outrun the buffer
      maybeExtrapolateBallOnly(wallNowMs - INTERP_DELAY_MS, snaps, drawState);
      predictMyPaddle(drawState, mySide, localInputs, dtSec);
      if (drawState.phase === "countdown" && drawState.pauseCooldownAt) {
        const secs = Math.max(0, Math.ceil((drawState.pauseCooldownAt - Date.now()) / 1000));
        renderer.setCountdown(secs);
      }
      renderer.draw(drawState);
    }
    raf = requestAnimationFrame(drawLoop);
  };
  raf = requestAnimationFrame(drawLoop);

  return () => {
    window.removeEventListener("keydown", keyDownHandler);
    window.removeEventListener("keyup", keyUpHandler);
    cancelAnimationFrame(raf);
    rt.send({ type: "match_unsubscribe", matchId });
    stop();
    rt.close();
    renderer.dispose();
  };
}
