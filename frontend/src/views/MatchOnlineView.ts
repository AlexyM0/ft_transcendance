// src/views/MatchLocalView.ts
import { domElem as h, mount } from "../ui/DomElement";
import { GameRenderer } from "../helpers/GameRenderer";
import { GameLocalDriver } from "../helpers/GameLocalDriver";
import { createGameLocalState } from "../helpers/GameLocalState";
import type { Settings } from "./PlayLocalView";
import type { MatchSettings, MatchSnapshot, MatchState, Side } from "../helpers/GameTypes";
import { Avatar } from "../ui/Avatar";
import * as http from "../api/http";
import { Realtime } from "../helpers/ws";
import type { AllWsIncoming, MWOInput, MWOTogglePause } from "../helpers/ws_types";
import { applySnapshotToMatch } from "../helpers/GameSnapshot";
import { auth } from "../store/auth.store";
import { createGameOnlineState } from "../helpers/GameOnlineState";

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
  const wrap = h("div", { class: "flex-1 min-h-0 grid place-items-center bg-emerald-50" });
  const canvas = h("canvas", { class: "block rounded-md shadow border border-emerald-100 bg-white" }) as HTMLCanvasElement;
  const header = h("div", { class: "h-16 px-4 border-b border-emerald-100 bg-emerald-50/70 flex items-center justify-between" });
  mount(root, header, mount(wrap, canvas));

  /** -- Game Settings */
  const renderer = new GameRenderer(wrap, canvas, header);
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
        renderer.setOver(state.winner?.name ?? null);
        break;
    }
  };

  /** -- Game driver */
  const rt = new Realtime("/api/ws");
  const stop = rt.on((msg: AllWsIncoming) => {
    if (msg.type === "ready") {
      rt.send({ type: "match_subscribe", matchId });
      // optional: kick off countdown if initial phase is paused
      rt.send({ type: "match_toggle_pause", matchId } satisfies MWOTogglePause);
      return; // don't fall through on the same frame
    }

    if (msg.type === "match_snapshot" && msg.matchId === matchId) {
      applySnapshotToMatch(state, msg.snapshot); // must set state.phase/pauseCooldownAt/winner from snapshot.runtime
      leftInfoScore.textContent = String(state.leftP.score);
      rightInfoScore.textContent = String(state.rightP.score);
      leftInfoName.textContent = state.leftP.name;
      rightInfoName.textContent = state.rightP.name;
      syncOverlayFromState();
    }
  });

  rt.connect();
  rt.send({ type: "match_subscribe", matchId });

  /** -- Keyboard mapping to inputs */
  const leftKeys = { up: "z", down: "s", left: "q", right: "d" };
  const rightKeys = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
  const findKey = (map: Record<string, string>, key: string) => (Object.entries(map).find(([, k]) => k === key)?.[0] as keyof typeof map | undefined) ?? undefined;

  const keyDownHandler = (e: KeyboardEvent) => {
    if (e.key === " " && !e.repeat) {
      rt.send({ type: "match_toggle_pause", matchId } satisfies MWOTogglePause);
      e.preventDefault();
      return;
    }

    const map = mySide === "left" ? leftKeys : rightKeys;
    const k = findKey(map as any, e.key);
    if (k) {
      rt.send({ type: "match_input", matchId, key: k as "up" | "down" | "left" | "right", pressed: true } satisfies MWOInput);
      e.preventDefault();
    }
  };

  const keyUpHandler = (e: KeyboardEvent) => {
    const map = mySide === "left" ? leftKeys : rightKeys;
    const k = findKey(map as any, e.key);
    if (k) {
      rt.send({ type: "match_input", matchId, key: k as "up" | "down" | "left" | "right", pressed: false } satisfies MWOInput);
      e.preventDefault();
    }
  };

  window.addEventListener("keydown", keyDownHandler, { passive: false });
  window.addEventListener("keyup", keyUpHandler, { passive: false });

  // Initial paint reflects bootstrap snapshot
  syncOverlayFromState();
  renderer.draw(state);

  // Draw loop just for smooth visuals between snapshots (optional)
  let raf = 0;
  const drawLoop = () => {
    if (state.phase === "countdown") {
      const secs = state.pauseCooldownAt ? Math.max(0, Math.ceil((state.pauseCooldownAt - Date.now()) / 1000)) : 0;
      renderer.setCountdown(secs);
    }
    renderer.draw(state);
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
