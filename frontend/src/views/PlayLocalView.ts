// src/views/PlayLocalView.ts
import * as http from "../api/http";
import { Avatar } from "../ui/Avatar";
import { domElem as h } from "../ui/DomElement";
import { fetchMyProfile } from "./ProfileView";

/** -- Types -- */

const DEFAULT_AVATAR = "/user.png";

export type UserRow = { id: number; pseudo: string; avatar_url: string | null };

export type MatchRow = {
  id: number;
  p1_id: number;
  p1_pseudo: string;
  p1_avatar_url: string | null;
  p2_id: number;
  p2_pseudo: string;
  p2_avatar_url: string | null;
  status: "pending" | "finished" | "canceled";
  winner_id: number | null;
  score_p1: number | null;
  score_p2: number | null;
  created_at: string;
};

type Points = 3 | 5 | 7 | 9;
type PaddleSizeKey = "small" | "medium" | "large";
type GameMode = "2d" | "3d";
type Side = "left" | "right";

export type Settings = {
  me: UserRow;
  opponent: UserRow | null;
  pointsToWin: Points;
  paddleSize: PaddleSizeKey;
  mySide: Side;
  freeMove: boolean;
  mode: GameMode;
  matchId: number | null;
};

function createDefaultSettings(me: UserRow, opponent?: UserRow) {
  return {
    me,
    opponent: opponent ?? null,
    pointsToWin: 3,
    paddleSize: "medium",
    mySide: "left",
    freeMove: false,
    mode: "2d",
    matchId: null,
  } as Settings;
}

async function leftSettingsPanel(state: Settings, setSideOptionNames: (state: Settings) => void, canStart: () => void) {
  const users: UserRow[] = (await http.getRequest<UserRow[]>("/api/users/all")).filter((u) => u.id !== state.me.id);

  const leftWrap = h("div", { class: "flex flex-col gap-3 p-6" });
  const leftHeader = h("div", { class: "text-lg font-semibold text-emerald-900", text: "Choose opponent" });
  const searchBar = h("input", {
    class: "px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
    attributes: { placeholder: "Search users…", type: "search" },
  }) as HTMLInputElement;
  const resultsWrap = h("div", { class: "max-h-130 overflow-auto space-y-1" });

  function userAsButton(u: UserRow) {
    const picked = state.opponent?.id === u.id;
    const btn = h("button", {
      class: "w-full flex items-center gap-3 px-3 py-2 rounded-xl " + (picked ? "bg-emerald-200/60" : "hover:bg-emerald-100/60"),
      attributes: { type: "button" },
    });
    btn.append(Avatar(u.avatar_url, 28), h("div", { class: "font-medium text-emerald-900 truncate", text: u.pseudo }));
    btn.addEventListener("click", () => {
      state.opponent = u;
      renderResults(users);
      setSideOptionNames(state);
      canStart();
    });
    return btn;
  }

  function renderResults(users: UserRow[]) {
    resultsWrap.replaceChildren();
    const q = searchBar.value.trim().toLowerCase();

    const base: UserRow[] = users.slice();
    if (state.opponent && !base.some((u) => u.id === state.opponent!.id)) {
      base.unshift(state.opponent);
    }

    const list = q ? base.filter((x) => x.pseudo.toLowerCase().includes(q) && x.id != state.me.id) : base;
    list.forEach((u) => resultsWrap.append(userAsButton(u)));

    canStart();
  }

  searchBar.addEventListener("input", () => renderResults(users));
  renderResults(users);

  leftWrap.append(leftHeader, searchBar, resultsWrap);
  return leftWrap;
}

async function rightSettingsPanel(state: Settings) {
  const rightWrap = h("div", { class: "flex flex-col gap-7 p-6 items-center bg-emerald-50" });
  const rightHeader = h("div", { class: "text-lg font-semibold text-slate-800", text: "Match settings" });
  const settingsWrap = h("div", { class: "flex flex-col gap-4 items-center" });

  /** -- Points -- */
  const pointsWrap = h("div", { class: "flex flex-col items-center gap-4" });
  const pointsHeader = h("div", { class: "text-sm font-semibold text-slate-600", text: "Points to win" });
  const pointsSelector = h("div", { class: "flex flex-wrap gap-2" });

  function pointsBtn(p: Points) {
    const btn = h("button", {
      class: "px-3 py-2 rounded-xl border " + (state.pointsToWin === p ? "bg-emerald-700 text-white border-emerald-600" : "border-slate-200 hover:bg-emerald-400 hover:text-white"),
      attributes: { type: "button" },
      text: `${p} points`,
    });
    btn.addEventListener("click", () => {
      state.pointsToWin = p;
      pointsSelector.querySelectorAll("button").forEach((x) => (x.className = x.className.replace(/bg-emerald-700.*|border-emerald-600/g, "border-slate-200")));
      btn.className = "px-3 py-2 rounded-xl border bg-emerald-700 text-white border-emerald-600";
    });
    pointsSelector.appendChild(btn);
  }
  ([3, 5, 7, 9] as Points[]).forEach((p) => pointsBtn(p));
  pointsWrap.append(pointsHeader, pointsSelector);
  settingsWrap.append(pointsWrap);

  /** -- Paddle Size -- */
  const paddleSizeWrap = h("div", { class: "flex flex-col items-center gap-4" });
  const paddleSizeHeader = h("div", { class: "text-sm  font-semibold text-slate-600", text: "Paddle" });
  const paddleSizeSelector = h("div", { class: "flex flex-wrap gap-10" });

  function paddleSizeBtn(s: PaddleSizeKey) {
    const btn = h("button", {
      class: "px-2 py-2 rounded-xl border border-slate-200 hover:bg-emerald-400 flex items-end gap-2",
      attributes: { type: "button", title: s },
    });
    const paddlePreviewBar = h("div", { class: "w-3 bg-emerald-700 rounded" });
    switch (s) {
      case "small":
        paddlePreviewBar.style.height = "33px";
        break;
      case "medium":
        paddlePreviewBar.style.height = "66px";
        break;
      case "large":
        paddlePreviewBar.style.height = "99px";
        break;
    }
    const paddleBtnText = h("div", { class: "text-xs text-slate-600 capitalize", text: s });
    btn.append(paddlePreviewBar, paddleBtnText);
    btn.addEventListener("click", () => {
      state.paddleSize = s;
      paddleSizeSelector.querySelectorAll("button").forEach((x) => x.classList.remove("ring-2", "ring-emerald-300"));
      btn.classList.add("ring-2", "ring-emerald-300");
    });
    if (s === state.paddleSize) btn.classList.add("ring-2", "ring-emerald-300");
    paddleSizeSelector.append(btn);
  }

  (["small", "medium", "large"] as PaddleSizeKey[]).forEach((s) => paddleSizeBtn(s));
  paddleSizeWrap.append(paddleSizeHeader, paddleSizeSelector);

  /** -- Free move toggle */
  const freeWrap = h("label", { class: "inline-flex items-center gap-3 cursor-pointer" });
  const freeCheckBox = h("input", { attributes: { type: "checkbox" }, class: "w-4 h-4 accent-emerald-600" }) as HTMLInputElement;
  const freeLabel = h("span", { class: "text-sm text-slate-700", text: "Allow free movement (all directions)" });
  freeCheckBox.checked = state.freeMove;
  freeCheckBox.addEventListener("change", () => {
    state.freeMove = freeCheckBox.checked;
  });
  freeWrap.append(freeCheckBox, freeLabel);
  paddleSizeWrap.append(freeWrap);
  settingsWrap.append(paddleSizeWrap);

  /** -- Side selector */

  /**
   *  Function to be called by left panel on selecting a player
   */
  function setSideOptionNames(state: Settings) {
    if (state.mySide === "left") {
      leftSidePlayer.textContent = state.me.pseudo;
      rightSidePlayer.textContent = state.opponent?.pseudo ?? "Opponent";
    } else {
      leftSidePlayer.textContent = state.opponent?.pseudo ?? "Opponent";
      rightSidePlayer.textContent = state.me.pseudo;
    }
  }

  const sidesWrap = h("div", { class: "w-full flex flex-col items-center gap-3" });
  const sidesHeader = h("div", { class: "text-sm font-semibold text-slate-600", text: "Side" });
  const sides = h("div", { class: "w-full flex flex-row items-center justify-around" });
  const leftSidePlayer = h("div", { class: "w-20 flex-none", text: state.me.pseudo });
  const rightSidePlayer = h("div", { class: "w-20 flex-none", text: state.opponent?.pseudo ?? "Opponent" });
  const sideBtn = h("button", {
    class: "px-3 py-2 rounded-xl bg-emerald-700 text-white border border-slate-200 hover:bg-emerald-400 flex items-center gap-2",
    attributes: { type: "button" },
  });
  const sideBtnIcon = h("i", { class: "fa-solid fa-right-left" });
  sideBtn.append(sideBtnIcon);
  sideBtn.addEventListener("click", () => {
    state.mySide = state.mySide === "left" ? "right" : "left";
    setSideOptionNames(state);
  });
  setSideOptionNames(state);
  sides.append(leftSidePlayer, sideBtn, rightSidePlayer);
  sidesWrap.append(sidesHeader, sides);
  settingsWrap.append(sidesWrap);

  /** -- Start button */
  const separator = h("div", { class: "h-0.25 w-[60%] my-2 bg-emerald-700/20" });

  const startLink = h("button", {
    class: "mt-1 inline-flex items-center justify-center px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40",
    attributes: { href: "#/play/local" }, // final fallback href; we’ll override in handler
    text: "Start match",
  });

  function canStart() {
    const ok = !!state.opponent;
    startLink.toggleAttribute("disabled", !ok);
  }

  startLink.addEventListener("click", async (e) => {
    if (startLink.hasAttribute("aria-disabled")) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    const match = await http.postRequest<MatchRow>("/api/matches", {
      meId: state.me.id,
      oppId: state.opponent!.id,
    });

    state.matchId = match.id;
    sessionStorage.setItem(`play:local:current`, JSON.stringify(state));

    location.hash = `/play/local/m`;
  });

  canStart();

  rightWrap.append(rightHeader, settingsWrap, separator, startLink);
  return { rightWrap, setSideOptionNames, canStart };
}

export async function PlayLocalView(root: HTMLElement) {
  root.replaceChildren();

  const myProfile = await fetchMyProfile();
  const me: UserRow = {
    id: myProfile.id,
    pseudo: myProfile.pseudo,
    avatar_url: myProfile.avatarUrl,
  };

  const state = createDefaultSettings(me);
  const { rightWrap, setSideOptionNames, canStart } = await rightSettingsPanel(state);
  const leftWrap = await leftSettingsPanel(state, setSideOptionNames, canStart);

  const panel = h("div", { class: "w-full grid md:grid-cols-2 gap-6 bg-white rounded-2xl border border-emerald-100 shadow" });
  panel.append(leftWrap, rightWrap);
  root.append(panel);

  return () => {};
}
