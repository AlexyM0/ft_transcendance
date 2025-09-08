// src/views/MatchLocalView.ts
import { domElem as h, mount } from "../ui/DomElement";
import { GameRenderer } from "../helpers/GameRenderer";
import { GameLocalDriver } from "../helpers/GameLocalDriver";
import { createGameLocalState } from "../helpers/GameLocalState";
import type { Settings } from "./PlayLocalView";
import type { MatchSettings, MatchState, Side } from "../helpers/GameTypes";
import { Avatar } from "../ui/Avatar";

export function MatchLocalView(root: HTMLElement) {
  /** -- Config settings from PlayView */
  const raw = sessionStorage.getItem("play:local:current");
  if (!raw) {
    location.hash = "/player/chooser";
    return () => {};
  }

  const configSettings: Settings = JSON.parse(raw);

  /** -- DOM elements */
  const wrap = h("div", { class: "flex-1 min-h-0 grid place-items-center bg-emerald-50" });
  const canvas = h("canvas", { class: "block rounded-md shadow border border-emerald-100 bg-white" }) as HTMLCanvasElement;
  const header = h("div", { class: "h-16 px-4 border-b border-emerald-100 bg-emerald-50/70 flex items-center justify-between" });
  mount(root, header, mount(wrap, canvas));

  /** -- Game Settings */
  const renderer = new GameRenderer(wrap, canvas, header);
  renderer.setBallSprite("/ball.png");

  const matchSettings: MatchSettings = {
    pointsToWin: configSettings.pointsToWin,
    paddleHeight: configSettings.paddleSize,
    freeMove: configSettings.freeMove,
    hostSide: configSettings.mySide,
  };
  const state: MatchState = createGameLocalState(
    configSettings.matchId!,
    { id: configSettings.me.id, name: configSettings.me.pseudo, avatar_url: configSettings.me.avatar_url },
    { id: configSettings.opponent!.id, name: configSettings.opponent!.pseudo, avatar_url: configSettings.opponent!.avatar_url },
    configSettings.mySide,
    matchSettings
  );

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
  const driver = GameLocalDriver(renderer, state, {
    onScore: (leftScore, rightScore) => {
      leftInfoScore.textContent = String(leftScore);
      rightInfoScore.textContent = String(rightScore);
    },
    onOver: (winnerId, l, r) => {
      // Call API put /api/matches/:id
      sessionStorage.removeItem("play:local:current");
    },
  });

  /** -- Keyboard mapping to inputs */
  const leftKeys = { up: "z", down: "s", left: "q", right: "d" };
  const rightKeys = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

  const keyDownHandler = (e: KeyboardEvent) => {
    if (e.key === " " && !e.repeat) {
      console.log("hihi space pressed");
      driver.togglePause();
      e.preventDefault();
      return;
    }

    const hit = (map: any, side: Side) => {
      const pair = Object.entries(map).find(([, k]) => k === e.key);
      if (pair) {
        driver.input(side, pair[0] as any, true);
        e.preventDefault();
      }
    };

    hit(leftKeys, "left");
    hit(rightKeys, "right");
  };

  const keyUpHandler = (e: KeyboardEvent) => {
    const hit = (map: any, side: Side) => {
      const pair = Object.entries(map).find(([, k]) => k === e.key);
      if (pair) {
        driver.input(side, pair[0] as any, false);
        e.preventDefault();
      }
    };

    hit(leftKeys, "left");
    hit(rightKeys, "right");
  };

  window.addEventListener("keydown", keyDownHandler, { passive: false });
  window.addEventListener("keyup", keyUpHandler, { passive: false });
  driver.start();

  return () => {
    window.removeEventListener("keydown", keyDownHandler);
    window.removeEventListener("keyup", keyUpHandler);
    driver.stop();
    renderer.dispose();
  };
}
