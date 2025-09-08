// src/views/PlayView.online.ts
import { Realtime, type MatchSettingsWire } from "../helpers/ws";
import * as http from "../api/http";
import { domElem as h, mount } from "../ui/DomElement";
import { Avatar } from "../ui/Avatar";
import type { Game2D } from "./PlayView";

type UserRow = { id: number; pseudo: string; avatar_url: string | null };

type OnlineCtx = {
  me: UserRow;
  ws: Realtime;
  onMatchStart: (matchId: number, settings: MatchSettingsWire, role: "host" | "guest") => void;
};

type Lobby = {
  matchId: number;
  hostId: number;
  guestId: number;
  settings: MatchSettingsWire;
  locked: boolean;
  ready: Record<number, boolean>;
};

// Minimal local copy of settings (host is source of truth)
function defaultWireSettings(): MatchSettingsWire {
  return {
    pointsToWin: 3,
    paddleSize: "medium",
    freeMove: false,
    mode: "2d",
    hostSide: "left",
  };
}

export function OnlinePanel(ctx: OnlineCtx) {
  const state = {
    selection: null as UserRow | null,
    inviteId: null as number | null,
    matchId: null as number | null,
    role: null as ("host" | "guest") | null,
    settings: defaultWireSettings(),
    locked: false,
    ready: new Map<number, boolean>(),
    opp: null as UserRow | null,
  };

  const wrap = h("div", { class: "w-full grid md:grid-cols-2 gap-6 bg-white rounded-2xl border border-indigo-100 shadow" });

  // Left : reuse your search user list
  const left = h("div", { class: "flex flex-col gap-3 p-6" });
  const leftInviteText = h("div", { class: "text-lg font-semibold text-indigo-900", text: "Invite a player" });
  left.append(leftInviteText);
  const users: UserRow[] = [];
  const results = h("div", { class: "max-h-130 overflow-auto space-y-1" });

  // Right : dynamic panel
  const right = h("div", { class: "flex flex-col gap-4 p-6 items-center bg-indigo-50" });
  const status = h("div", { class: "text-sm text-slate-700" });
  const btnPrimary = h("button", {
    class: "px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-40",
    attributes: {
      type: "button",
      disabled: "true",
    },
    text: "Send Invite",
  });
  const btnSecondary = h("button", {
    class: "px-4 py-2 rounded-xl bg-slate-200 text-slate-800 disabled:opacity-40",
    attributes: {
      type: "button",
      disabled: "true",
    },
    text: "Cancel Invite",
  });
  right.append(status, btnPrimary, btnSecondary);

  // Functions - dynamic behaviour
  async function loadUsers() {
    const rows = await http.getRequest<UserRow[]>("/api/users/all");
    users.splice(0, users.length, ...rows.filter((u) => u.id !== ctx.me.id));
    renderUsers();
  }

  function pick(u: UserRow) {
    state.selection = u;
    renderUsers();
    renderRight();
  }

  function userRow(u: UserRow) {
    const btn = h("button", {
      class: "w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-indigo-100/60",
      attributes: {
        type: "button",
      },
    });
    const avatar = Avatar(u.avatar_url ?? "/user.png", 28);
    const pseudo = h("div", { class: "font-medium text-indigo-900 truncate", text: u.pseudo });
    btn.append(avatar, pseudo);
    btn.addEventListener("click", () => pick(u));
    return btn;
  }

  function renderUsers() {
    results.replaceChildren();
    users.forEach((u) => results.append(userRow(u)));
  }

  function setLobby(lobby: Lobby) {
    state.matchId = lobby.matchId;
    state.settings = lobby.settings;
    state.locked = lobby.locked;
    state.ready = new Map<number, boolean>(Object.entries(lobby.ready).map(([k, v]) => [Number(k), v]));
    state.role = lobby.hostId === ctx.me.id ? "host" : "guest";
    state.opp = users.find((u) => u.id === (state.role === "host" ? lobby.guestId : lobby.hostId)) || state.selection || state.opp;
  }

  function renderRight() {
    btnPrimary.disabled = true;
    btnSecondary.disabled = true;

    if (!state.matchId && !state.inviteId) {
      status.textContent = state.selection ? `Invite ${state.selection.pseudo} to play` : "Pick a player to invite";
      btnPrimary.textContent = "Send Invite";
      btnPrimary.disabled = !state.selection;
      btnPrimary.onclick = () => {
        const to = state.selection!.id;
        ctx.ws.inviteSend(to);
        status.textContent = "Invite sent...";
        btnPrimary.disabled = true;
        btnSecondary.textContent = "Cancel Invite";
        btnSecondary.disabled = false;
        btnSecondary.onclick = () => state.inviteId && ctx.ws.inviteCancel(state.inviteId);
      };
      return;
    }

    if (state.inviteId && !state.matchId) {
      if (state.role === "guest") {
        status.textContent = `Invite from ${state.opp?.pseudo ?? "Player"}`;
        btnPrimary.textContent = "Accept";
        btnSecondary.textContent = "Decline";
        btnPrimary.disabled = false;
        btnSecondary.disabled = false;
        btnPrimary.onclick = () => ctx.ws.inviteAnswer(state.inviteId!, true);
        btnSecondary.onclick = () => ctx.ws.inviteAnswer(state.inviteId!, false);
      } else {
        status.textContent = "Waiting for opponent to accept...";
        btnPrimary.textContent = "Send Invite";
        btnPrimary.disabled = true;
        btnSecondary.textContent = "Cancel Invite";
        btnSecondary.disabled = false;
        btnSecondary.onclick = () => ctx.ws.inviteCancel(state.inviteId!);
      }
      return;
    }

    const roles = state.role === "host" ? "(host)" : "(guest)";
    status.textContent = `Lobby ${roles} - ${state.opp?.pseudo ?? ""}`;

    if (state.role === "host") {
      btnPrimary.textContent = "Ready";
      btnSecondary.textContent = "Cancel";
      btnPrimary.disabled = state.locked && state.ready.get(ctx.me.id) === true;
      btnSecondary.disabled = !(state.ready.get(ctx.me.id) === true);
      btnPrimary.onclick = () => {
        ctx.ws.matchSetSettings(state.matchId!, state.settings);
        ctx.ws.matchReady(state.matchId!, true);
      };
      btnSecondary.onclick = () => {
        ctx.ws.matchReady(state.matchId!, false);
      };
    } else {
      btnPrimary.textContent = "Ready";
      btnSecondary.textContent = "Cancel";
      const hostReady = state.locked;
      btnPrimary.disabled = !hostReady || state.ready.get(ctx.me.id) === true;
      btnSecondary.disabled = !hostReady || !(state.ready.get(ctx.me.id) === true);
      btnPrimary.onclick = () => ctx.ws.matchReady(state.matchId!, true);
      btnSecondary.onclick = () => ctx.ws.matchReady(state.matchId!, false);
    }
  }

  /**
   * Mounting DOM
   */
  left.append(results);
  mount(wrap, left, right);
  loadUsers();

  /**
   * WS binding
   */
  const off = ctx.ws.on((msg) => {
    if (msg.type === "match_invite" && msg.to === ctx.me.id) {
      state.inviteId = msg.inviteId;
      state.role = "guest";
      state.selection = users.find((u) => u.id === msg.from) ?? state.selection;
      state.opp = users.find((u) => u.id === msg.from) ?? state.opp;
      renderRight();
    } else if (msg.type === "match_invite_canceled" && msg.inviteId === state.inviteId) {
      state.inviteId = null;
      state.role = null;
      state.matchId = null;
      state.opp = null;
      state.locked = false;
      renderRight();
    } else if (msg.type === "match_invite_response" && msg.inviteId === state.inviteId) {
      if (!msg.accepted) {
        state.inviteId = null;
        state.role = null;
        state.matchId = null;
        state.opp = null;
        state.locked = false;
        renderRight();
      }
    } else if (msg.type === "match_lobby") {
      setLobby(msg);
      ctx.ws.subscribeMatch(msg.matchId);
      renderRight();
    } else if (msg.type === "match_ready_state" && msg.matchId === state.matchId) {
      state.ready.set(msg.userId, msg.ready);
      renderRight();
    } else if (msg.type === "match_start" && msg.matchId === state.matchId) {
      ctx.onMatchStart(state.matchId!, state.settings, state.role!);
    } else if (msg.type === "error") {
      status.textContent = `Error: ${msg.message}`;
    }
  });

  return { wrap, dispose: () => off() };
}

export function attachNetDriver(game: Game2D, ws: Realtime, matchId: number, mySide: "left" | "right") {
  game.enableNetMode();

  game.setKeyForwarder((key, pressed) => {
    ws.matchInput(matchId, key, pressed);
  });

  game.setPauseForwarder(() => {
    ws.matchTogglePause(matchId);
  });

  const off = ws.on((msg) => {
    if ("matchId" in msg && msg.matchId !== matchId) return;
    if (msg.type === "match_snapshot") {
      game.paused = false;
      game.applyAuthoritative(msg.state);
    } else if (msg.type === "match_paused") {
      game.paused = true;
      game.setCountdown(null);
    } else if (msg.type === "match_resumed") {
      // server may choose to resume instantly or after countdown message
      game.paused = false;
      game.setCountdown(null);
    } else if (msg.type === "match_countdown") {
      game.paused = true;
      game.setCountdown(msg.seconds);
      if (msg.seconds === 0) {
        game.setCountdown(null);
        game.paused = false;
      }
    } else if (msg.type === "match_over") {
      game.paused = true;
      game.setCountdown(null);
    }
  });

  return () => off();
}

export function PlayOnlineView(root: HTMLElement) {
  root.replaceChildren(h("div", { text: "coucou" }));
}
