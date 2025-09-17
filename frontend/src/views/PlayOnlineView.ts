// frontend/src/views/PlayOnlineView.ts
import { Lobbies, subscribe as subscribeToLobbies } from "../helpers/LobbyOnlineState";
import { Avatar } from "../ui/Avatar";
import { domElem as h } from "../ui/DomElement";
import { fetchMyProfile } from "./ProfileView";
import type { UserRow, Points, PaddleSizeKey, Side, Settings, LobbyState } from "../helpers/state_types";
import * as apiFriends from "../api/friends";

/* ======================================================================= */
/* Utilities                                                               */
/* ======================================================================= */

function createDefaultSettings(me: UserRow, opponent?: UserRow) {
  return {
    me,
    opponent: opponent ?? null,
    pointsToWin: 3,
    paddleHeight: "medium",
    mySide: "left",
    freeMove: false,
    matchId: null,
  } as Settings;
}

/* ======================================================================= */
/* Overlays                                                               */
/* ======================================================================= */

function waitingOverlay(wrap: HTMLElement, onCancel: () => void) {
  const overlay = h("div", { class: "fixed inset-0 bg-black/50 grid place-items-center z-50 hidden" });
  const card = h("div", { class: "bg-white rounded-xl shadow-2xl px-8 py-10 flex flex-col items-center gap-6 w-[min(90vw, 420px)]" });
  const msg = h("div", { class: "text-xl font-semibold text-slate-800 text-center" });
  const throbber = h("div", { class: "w-10 h-10 rounded-full border-4 border-slate-200 border-t-emerald-500 animate-spin" });
  const cancel = h("button", { class: "px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-700", text: "Cancel" });

  cancel.addEventListener("click", () => {
    onCancel();
    closeWaitingOverlay();
  });

  card.append(msg, throbber, cancel);
  overlay.append(card);

  function openWaitingOverlay(text: string) {
    overlay.classList.remove("hidden");
    msg.textContent = text;
  }

  function setWaitingOverlayMessage(text: string) {
    msg.textContent = text;
  }

  function closeWaitingOverlay() {
    overlay.classList.add("hidden");
  }

  wrap.append(overlay);

  return { openWaitingOverlay, closeWaitingOverlay, setWaitingOverlayMessage };
}

function decisionOverlay(wrap: HTMLElement, onAccept: () => void, onDecline: () => void) {
  const overlay = h("div", { class: "fixed inset-0 bg-black/50 grid place-items-center z-50 hidden" });
  const card = h("div", { class: "bg-white rounded-xl shadow-2xl px-8 py-10 flex flex-col items-center gap-6 w-[min(90vw, 420px)]" });
  const msg = h("div", { class: "text-xl font-semibold text-slate-800 text-center" });
  const actions = h("div", { class: "flex gap-3" });
  const accept = h("button", { class: "px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500", text: "Accept" });
  const decline = h("button", { class: "px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700", text: "Decline" });

  accept.onclick = () => {
    closeDecisionOverlay();
    onAccept();
  };
  decline.onclick = () => {
    closeDecisionOverlay();
    onDecline();
  };

  actions.append(accept, decline);
  card.append(msg, actions);
  overlay.append(card);

  function openDecisionOverlay(text: string) {
    msg.textContent = text;
    overlay.classList.remove("hidden");
  }

  function setDecisionOverlayMessage(t: string) {
    msg.textContent = t;
  }

  function closeDecisionOverlay() {
    overlay.classList.add("hidden");
  }

  wrap.append(overlay);
  return { openDecisionOverlay, closeDecisionOverlay, setDecisionOverlayMessage };
}

/* ======================================================================= */
/* Left panel: selector (pre-lobby) and players (in-lobby)                 */
/* ======================================================================= */

const usersById = new Map<number, UserRow>();

function makePlayerRow(user: UserRow | null, ready: boolean, label: string) {
  const row = h("div", { class: "flex items-center gap-3 p-2 rounded-lg border border-emerald-100 bg-white" });
  const avatar = Avatar(user?.avatar_url ?? null, 28);
  const name = h("div", { class: "font-semibold text-emerald-900", text: user?.pseudo ?? "" });
  const userLabel = h("span", { class: "font-medium text-emerald-900", text: label });

  const badge = h("span", {
    class: "ml-auto text-xs font-semibold px-2 py-1 rounded " + (ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"),
    text: ready ? "READY" : "WAITING",
  });
  row.append(avatar, name, userLabel, badge);
  return { row, name, badge };
}

function buildLeftSelector(state: Settings, setSideOptionNames: (state: Settings) => void) {
  const leftWrap = h("div", { class: "flex flex-col gap-3 p-6" });
  const leftHeader = h("div", { class: "text-lg font-semibold text-emerald-900", text: "Choose opponent" });
  const searchBar = h("input", {
    class: "px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
    attributes: { placeholder: "Search users…", type: "search" },
  }) as HTMLInputElement;
  const resultsWrap = h("div", { class: "max-h-130 overflow-auto space-y-1" });

  async function loadUsers() {
    const friends = await apiFriends.getFriends();
    const users: UserRow[] = friends.map(({ id, pseudo, avatar_url }) => ({ id, pseudo, avatar_url }));
    users.forEach((u) => usersById.set(u.id, u));

    function userAsButton(u: UserRow) {
      const picked = state.opponent?.id === u.id;
      const busy = Lobbies.isUserBusy(u.id);
      const btn = h("button", {
        class: "w-full flex items-center gap-3 px-3 py-2 rounded-xl " + (busy ? "opacity-50 cursor-not-allowed" : picked ? "bg-emerald-200/60" : "hover:bg-emerald-100/60"),
        attributes: {
          type: "button",
          title: busy ? "Player is busy" : picked ? "Selected" : "Invite",
        },
      });
      btn.append(Avatar(u.avatar_url, 28), h("div", { class: "font-medium text-emerald-900 truncate", text: u.pseudo }));
      if (!busy) {
        btn.addEventListener("click", () => {
          state.opponent = u;
          Lobbies.selectOpponent(u);
          renderResults(users);
          setSideOptionNames(state);
        });
      }
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
    }

    searchBar.addEventListener("input", () => renderResults(users));
    renderResults(users);
  }

  leftWrap.append(leftHeader, searchBar, resultsWrap);
  loadUsers();
  return leftWrap;
}

function buildLeftLobbyBlock() {
  const leftLobbyWrap = h("div", { class: "flex flex-col gap-3 p-6" });
  const leftLobbytitle = h("div", { class: "text-lg font-semibold text-emerald-900", text: "Lobby players" });
  const hostRow = makePlayerRow(null, false, "Host");
  const guestRow = makePlayerRow(null, false, "Guest");
  const bothWrap = h("div", { class: "flex flex-col gap-2" });
  bothWrap.append(hostRow.row, guestRow.row);
  leftLobbyWrap.append(leftLobbytitle, bothWrap);

  function updateFromState(s: LobbyState, me: UserRow, selectedOpponent: UserRow | null) {
    const snap = s.lobbySnapshot;
    if (!snap) return;

    const hostUser = snap.hostId === me.id ? me : selectedOpponent ?? usersById.get(snap.hostId) ?? null;
    const guestUser = snap.guestId === me.id ? me : selectedOpponent ?? usersById.get(snap.guestId) ?? null;

    // Update labels
    (hostRow.name as HTMLDivElement).textContent = hostUser?.pseudo ?? `User ${snap.hostId}`;
    (guestRow.name as HTMLDivElement).textContent = guestUser?.pseudo ?? `User ${snap.guestId}`;

    // Update ready badges
    const hostReady = !!snap.ready[snap.hostId];
    const guestReady = !!snap.ready[snap.guestId];

    hostRow.badge.className = "ml-auto text-xs font-semibold px-2 py-1 rounded " + (hostReady ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600");
    hostRow.badge.textContent = hostReady ? "READY" : "WAITING";

    guestRow.badge.className = "ml-auto text-xs font-semibold px-2 py-1 rounded " + (guestReady ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600");
    guestRow.badge.textContent = guestReady ? "READY" : "WAITING";
  }

  return { leftLobbyWrap, updateFromState };
}

/* ======================================================================= */
/* Right panel: settings + actions                                         */
/* ======================================================================= */

function buildRightSettingsPanel(state: Settings) {
  const rightWrap = h("div", { class: "flex flex-col gap-7 p-6 items-center bg-emerald-50" });
  const rightHeader = h("div", { class: "text-lg font-semibold text-slate-800", text: "Match settings" });
  const settingsWrap = h("div", { class: "flex flex-col gap-4 items-center" });

  /** -- Points -- */
  const pointsWrap = h("div", { class: "flex flex-col items-center gap-4" });
  const pointsHeader = h("div", { class: "text-sm font-semibold text-slate-600", text: "Points to win" });
  const pointsSelector = h("div", { class: "flex flex-wrap gap-2" });
  const pointBtns: HTMLButtonElement[] = [];

  function selectPoints(p: Points, silent = false) {
    state.pointsToWin = p;
    if (!silent) Lobbies.setSettings({ pointsToWin: p });
    pointBtns.forEach((b) => (b.className = b.className.replace(/bg-emerald-700.*|border-emerald-600/g, "border-slate-200")));
    const idx = [3, 5, 7, 9].indexOf(p);
    if (idx >= 0) pointBtns[idx].className = "px-3 py-2 rounded-xl border bg-emerald-700 text-white border-emerald-600";
  }

  function createPointButton(p: Points) {
    const btn = h("button", {
      class: "px-3 py-2 rounded-xl border " + (state.pointsToWin === p ? "bg-emerald-700 text-white border-emerald-600" : "border-slate-200 hover:bg-emerald-400 hover:text-white"),
      attributes: { type: "button" },
      text: `${p} points`,
    });
    btn.addEventListener("click", () => selectPoints(p));
    pointBtns.push(btn);
    pointsSelector.appendChild(btn);
  }

  ([3, 5, 7, 9] as Points[]).forEach((p) => createPointButton(p));

  pointsWrap.append(pointsHeader, pointsSelector);
  settingsWrap.append(pointsWrap);

  /** -- Paddle Size -- */
  const paddleSizeWrap = h("div", { class: "flex flex-col items-center gap-4" });
  const paddleSizeHeader = h("div", { class: "text-sm  font-semibold text-slate-600", text: "Paddle" });
  const paddleSizeSelector = h("div", { class: "flex flex-wrap gap-10" });
  const paddleSizeBtns: HTMLButtonElement[] = [];

  function selectPaddleSize(s: PaddleSizeKey, silent = false) {
    state.paddleHeight = s;
    if (!silent) Lobbies.setSettings({ paddleHeight: s });
    paddleSizeSelector.querySelectorAll("button").forEach((x) => x.classList.remove("ring-2", "ring-emerald-300"));
    const map: Record<PaddleSizeKey, number> = { small: 0, medium: 1, large: 2 };
    paddleSizeBtns[map[s]].classList.add("ring-2", "ring-emerald-300");
  }

  function createPaddleSizeBtn(s: PaddleSizeKey) {
    const btn = h("button", {
      class: "px-2 py-2 rounded-xl border border-slate-200 hover:bg-emerald-400 flex items-end gap-2",
      attributes: { type: "button", title: s },
    });
    const paddlePreviewBar = h("div", { class: "w-3 bg-emerald-700 rounded" });
    paddlePreviewBar.style.height = s === "small" ? "33px" : s === "medium" ? "66px" : "99px";
    const paddleBtnText = h("div", { class: "text-xs text-slate-600 capitalize", text: s });
    btn.append(paddlePreviewBar, paddleBtnText);
    btn.addEventListener("click", () => {
      selectPaddleSize(s);
    });
    if (s === state.paddleHeight) btn.classList.add("ring-2", "ring-emerald-300");
    paddleSizeBtns.push(btn);
    paddleSizeSelector.append(btn);
  }

  (["small", "medium", "large"] as PaddleSizeKey[]).forEach((s) => createPaddleSizeBtn(s));
  paddleSizeWrap.append(paddleSizeHeader, paddleSizeSelector);

  /** -- Free move toggle */
  const freeWrap = h("label", { class: "inline-flex items-center gap-3 cursor-pointer" });
  const freeCheckBox = h("input", { attributes: { type: "checkbox" }, class: "w-4 h-4 accent-emerald-600" }) as HTMLInputElement;
  const freeLabel = h("span", { class: "text-sm text-slate-700", text: "Allow free movement (all directions)" });
  freeCheckBox.checked = state.freeMove;
  freeCheckBox.addEventListener("change", () => {
    state.freeMove = freeCheckBox.checked;
    Lobbies.setSettings({ freeMove: freeCheckBox.checked });
  });
  freeWrap.append(freeCheckBox, freeLabel);
  paddleSizeWrap.append(freeWrap);
  settingsWrap.append(paddleSizeWrap);

  /** -- Side selector */
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

  function updateSideLabels() {
    if (state.mySide === "left") {
      leftSidePlayer.textContent = state.me.pseudo;
      rightSidePlayer.textContent = state.opponent?.pseudo ?? "Opponent";
    } else {
      leftSidePlayer.textContent = state.opponent?.pseudo ?? "Opponent";
      rightSidePlayer.textContent = state.me.pseudo;
    }
  }

  sideBtn.addEventListener("click", () => {
    state.mySide = state.mySide === "left" ? "right" : "left";
    Lobbies.setSettings({ hostSide: state.mySide });
    updateSideLabels();
  });
  updateSideLabels();
  sides.append(leftSidePlayer, sideBtn, rightSidePlayer);
  sidesWrap.append(sidesHeader, sides);
  settingsWrap.append(sidesWrap);

  /** -- Invite & Start button */
  const separator = h("div", { class: "h-0.25 w-[60%] my-2 bg-emerald-700/20" });

  const wrapBtn = h("div", { class: "flex flex-col gap-4" });

  const inviteBtn = h("button", {
    class: "mt-1 inline-flex items-center justify-center px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 shadow",
    attributes: { type: "button" },
    text: "Invite player",
  });

  const startBtn = h("button", {
    class: "mt-1 inline-flex items-center justify-center px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 shadow",
    attributes: { type: "button" },
    text: "Start match",
  });
  wrapBtn.append(inviteBtn, startBtn);

  /** -- Mount with right panel */
  rightWrap.append(rightHeader, settingsWrap, separator, wrapBtn);

  /** -- Enabled/Disable controls - host can edit in-lobby, guest is read-only */
  function setSettingsEnabled(enabled: boolean) {
    for (const b of pointBtns) b.toggleAttribute("disabled", !enabled);
    for (const b of paddleSizeBtns) b.toggleAttribute("disabled", !enabled);
    sideBtn.toggleAttribute("disabled", !enabled);
    freeCheckBox.toggleAttribute("disabled", !enabled);
  }

  function setInviteMode(mode: "invite" | "cancelInvite" | "cancelLobby" | "disabled") {
    const baseClasses = "mt-1 inline-flex items-center justify-center px-4 py-3 rounded-xl text-white disabled:opacity-40 shadow ";
    let updatedClasses = "";
    let label = "Invite player";

    switch (mode) {
      case "invite":
        updatedClasses = "bg-indigo-600 hover:bg-indigo-500";
        label = "Invite player";
        inviteBtn.disabled = false;
        break;
      case "cancelInvite":
        updatedClasses = "bg-red-600 hover:bg-red-500";
        label = "Cancel Invite";
        inviteBtn.disabled = false;
        break;
      case "cancelLobby":
        updatedClasses = "bg-red-600 hover:bg-red-500";
        label = "Cancel Lobby";
        inviteBtn.disabled = false;
        break;
      case "disabled":
        updatedClasses = "bg-indigo-600";
        label = "Invite player";
        inviteBtn.disabled = true;
        break;
    }
    inviteBtn.className = baseClasses + updatedClasses;
    inviteBtn.textContent = label;
  }

  function reflectSettingsFromSnapshot(s: LobbyState) {
    const lobbySnapshot = s.lobbySnapshot;
    if (!lobbySnapshot) return;

    state.pointsToWin = lobbySnapshot.settings.pointsToWin as Points;
    state.paddleHeight = lobbySnapshot.settings.paddleHeight as PaddleSizeKey;
    state.freeMove = !!lobbySnapshot.settings.freeMove;

    state.mySide = lobbySnapshot.settings.hostSide as Side;

    selectPoints(state.pointsToWin, true);
    selectPaddleSize(state.paddleHeight, true);
    freeCheckBox.checked = state.freeMove;
    updateSideLabels();
  }

  return { rightWrap, inviteBtn, startBtn, reflectSettingsFromSnapshot, updateSideLabels, setSettingsEnabled, setInviteMode };
}

/* ======================================================================= */
/* The View                                                                */
/* ======================================================================= */

export async function PlayOnlineView(root: HTMLElement) {
  /** -- Initial setup */
  root.replaceChildren();
  Lobbies.init();

  const myProfile = await fetchMyProfile();
  const me: UserRow = {
    id: myProfile.id,
    pseudo: myProfile.pseudo,
    avatar_url: myProfile.avatarUrl,
  };

  const localSettings = createDefaultSettings(me);
  const viewWrap = h("div", { class: "flex flex-col gap-6 items-center" });

  /** -- DOM elements - Overlay invite */
  const wait = waitingOverlay(viewWrap, () => Lobbies.cancelInvite());
  const decide = decisionOverlay(
    viewWrap,
    () => Lobbies.answerActiveInvite(true),
    () => Lobbies.answerActiveInvite(false)
  );

  /** -- DOM elements - creation of panels */
  const rightPanel = buildRightSettingsPanel(localSettings);

  const leftPanel = h("div", { class: "contents" });
  const leftSelector = buildLeftSelector(localSettings, rightPanel.updateSideLabels);
  const leftLobbyBlock = buildLeftLobbyBlock();
  leftLobbyBlock.leftLobbyWrap.classList.add("hidden");
  leftPanel.append(leftSelector, leftLobbyBlock.leftLobbyWrap);

  const panel = h("div", { class: "w-full grid md:grid-cols-2 gap-6 bg-white rounded-2xl border border-emerald-100 shadow" });
  panel.append(leftPanel, rightPanel.rightWrap);

  /** -- DOM elements - back button */
  const backBtn = h("button", { class: "px-6 py-2 bg-emerald-700 rounded rounded-lg flex flex-row gap-6 items-center text-white text-lg font-semibold hover:bg-emerald-400" });
  const backIcon = h("i", { class: "fa-solid fa-circle-arrow-left" });
  const backText = h("span", { text: "Back" });
  backBtn.append(backIcon, backText);
  backBtn.addEventListener("click", () => {
    const s = Lobbies.getState();
    if (s.outgoing?.inviteId != null) Lobbies.cancelInvite();
    if (s.lobbySnapshot) Lobbies.leaveLobby();
    location.hash = `/play`;
  });

  /** -- DOM elements - compose the page */
  viewWrap.append(panel, backBtn);
  root.append(viewWrap);

  /** -- Navigate on start - once lobby becomes locked, move both players to the game view */
  let movedToMatch = false;
  function maybeGoToMatch() {
    if (movedToMatch) return;
    movedToMatch = true;

    location.hash = "/play/online/m";
  }

  /** Subscription - wire all states with LobbyOnlineState */
  const stop = subscribeToLobbies((s) => {
    if (s.lobbySnapshot) {
      leftSelector.classList.add("hidden");
      leftLobbyBlock.leftLobbyWrap.classList.remove("hidden");
      leftLobbyBlock.updateFromState(s, localSettings.me, localSettings.opponent ?? null);

      const iAmHost = s.lobbySnapshot.hostId === s.meId;
      rightPanel.setSettingsEnabled(iAmHost);
      rightPanel.reflectSettingsFromSnapshot(s);
      rightPanel.startBtn.toggleAttribute("disabled", !iAmHost);
      rightPanel.startBtn.onclick = iAmHost
        ? (e) => {
            e.preventDefault();
            Lobbies.setReady(true);
          }
        : null;

      if (s.lobbySnapshot.locked) {
        maybeGoToMatch();
      }
    } else {
      leftLobbyBlock.leftLobbyWrap.classList.add("hidden");
      leftSelector.classList.remove("hidden");

      rightPanel.startBtn.toggleAttribute("disabled", true);
      rightPanel.startBtn.onclick = null;
      rightPanel.setSettingsEnabled(true);
    }

    // Handle 'invite player' button
    let mode: "invite" | "cancelInvite" | "cancelLobby" | "disabled";
    if (s.lobbySnapshot) mode = "cancelLobby";
    else if (s.outgoing || s.activeIncoming) mode = "cancelInvite";
    else if (Lobbies.canInviteSelected()) mode = "invite";
    else mode = "disabled";
    rightPanel.setInviteMode(mode);

    rightPanel.inviteBtn.onclick = (e) => {
      e.preventDefault();
      switch (mode) {
        case "invite":
          Lobbies.setSettings({
            pointsToWin: localSettings.pointsToWin,
            paddleHeight: localSettings.paddleHeight,
            freeMove: localSettings.freeMove,
            hostSide: localSettings.mySide,
          });
          Lobbies.inviteSelected();
          break;
        case "cancelInvite":
          Lobbies.cancelInvite();
          break;
        case "cancelLobby":
          Lobbies.leaveLobby();
          break;
        case "disabled":
          break;
      }
    };

    if (s.outgoing) {
      const toId = s.outgoing.to;
      const name = toId ? usersById.get(toId)?.pseudo ?? "Opponent" : "Opponent";
      wait.openWaitingOverlay(`Waiting for ${name} to accept invite...`);
    } else {
      wait.closeWaitingOverlay();
    }

    if (s.activeIncoming) {
      const from = s.activeIncoming.from;
      const name = usersById.get(from)?.pseudo ?? "Player";
      decide.openDecisionOverlay(`${name} invited you to a match.`);
    } else {
      decide.closeDecisionOverlay();
    }
  });

  return () => {
    stop();
  };
}
