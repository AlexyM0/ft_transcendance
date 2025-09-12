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

export function MatchOnlineView(root: HTMLElement) {
  /** -- Config settings from PlayView */
  const raw = sessionStorage.getItem("play:online:current");
  if (!raw) {
    location.hash = "/player/chooser";
    return () => {};
  }

  const { matchId, state } = JSON.parse(raw) as { matchId: number; state: MatchState };
  const hostSide = auth.get().meId === state.leftP.id ? "left" : "right";

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
  const leftInfoAvatar = Avatar(state.leftP.avatar_url, 28);
  const leftInfoName = h("span", { class: "font-bold", text: state.leftP.name });
  const leftInfoScore = h("span", { class: "ml-2 font-bold text-lg text-emerald-700 bg-white rounded-lg min-w-10 text-center shadow", text: String(state.leftP.score) });
  mount(leftInfoWrap, leftInfoAvatar, leftInfoName, leftInfoScore);

  const rightInfoWrap = h("div", { class: "flex items-center gap-2" });
  const rightInfoScore = h("span", { class: "mr-2 font-bold text-lg text-emerald-700 bg-white rounded-lg min-w-10 text-center shadow", text: String(state.rightP.score) });
  const rightInfoName = h("span", { class: "font-bold", text: state.rightP.name });
  const rightInfoAvatar = Avatar(state.rightP.avatar_url, 28);
  mount(rightInfoWrap, rightInfoScore, rightInfoName, rightInfoAvatar);

  mount(header, leftInfoWrap, rightInfoWrap);

  /** -- Game driver */
  const rt = new Realtime("/api/ws");
  const stop = rt.on((msg: AllWsIncoming) => {
    if (msg.type === "match_snapshot" && msg.matchId === matchId) {
      applySnapshotToMatch(state, msg.snapshot);
      renderer.draw(state);
      leftInfoScore.textContent = String(state.leftP.score);
      rightInfoScore.textContent = String(state.rightP.score);
    } else if (msg.type === "match_paused" && msg.matchId === matchId) {
      renderer.setPaused(true);
      renderer.setCountdown(null);
    } else if (msg.type === "match_countdown" && msg.matchId === matchId) {
      renderer.setPaused(true);
      renderer.setCountdown(msg.seconds);
    } else if (msg.type === "match_resumed" && msg.matchId === matchId) {
      renderer.setPaused(false);
      renderer.setCountdown(null);
    } else if (msg.type === "match_score" && msg.matchId === matchId) {
      leftInfoScore.textContent = String(msg.left);
      rightInfoScore.textContent = String(msg.right);
    } else if (msg.type === "match_over" && msg.matchId === matchId) {
      renderer.setPaused(true);
      renderer.setCountdown(null);
      renderer.setOver(msg.winner);
    }
  });

  rt.connect();
  rt.send({ type: "match_subscribe", matchId });
  rt.send({ type: "match_toggle_pause", matchId });

  /** -- Keyboard mapping to inputs */
  const leftKeys = { up: "z", down: "s", left: "q", right: "d" };
  const rightKeys = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

  const keyDownHandler = (e: KeyboardEvent) => {
    if (e.key === " " && !e.repeat) {
      rt.send({ type: "match_toggle_pause", matchId } satisfies MWOTogglePause);
      e.preventDefault();
      return;
    }

    const hit = (map: any) => Object.entries(map).find(([, k]) => k === e.key)?.[0] as keyof typeof map | undefined;
    const map = hostSide === "left" ? leftKeys : rightKeys;
    const k = hit(map);
    if (k) {
      rt.send({ type: "match_input", matchId, key: k as "left" | "right" | "up" | "down", pressed: true } satisfies MWOInput);
      e.preventDefault();
    }
  };

  const keyUpHandler = (e: KeyboardEvent) => {
    const hit = (map: any) => Object.entries(map).find(([, k]) => k === e.key)?.[0] as keyof typeof map | undefined;
    const map = hostSide === "left" ? leftKeys : rightKeys;
    const k = hit(map);
    if (k) {
      rt.send({ type: "match_input", matchId, key: k as "left" | "right" | "up" | "down", pressed: true } satisfies MWOInput);
      e.preventDefault();
    }
  };

  window.addEventListener("keydown", keyDownHandler, { passive: false });
  window.addEventListener("keyup", keyUpHandler, { passive: false });

  // Draw loop just for smooth visuals between snapshots (optional)
  let raf = 0;
  const drawLoop = () => {
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
