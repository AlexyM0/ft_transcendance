// src/views/TournamentsView.ts

import { TournamentsAPI } from "../api/tournaments";
import type { CreateTournamentPayload, TournamentFull, TournamentLite, TournamentMatch, TournamentPlayerSlot, TournamentStatus } from "../api/types";
import { UsersAPI } from "../api/users";
import type { MatchSettings } from "../helpers/GameTypes";
import type { PublicUser } from "../helpers/state_types";
import { auth } from "../store/auth.store";
import { domElem as h } from "../ui/DomElement";

export function draftRound(tournamentId: number, players: TournamentPlayerSlot[]): TournamentMatch[] {
  const n = players.length;
  const idx = [...Array(n).keys()];

  if (n < 2) return [];

  const isOdd = n % 2 === 1;
  if (isOdd) idx.push(-1);

  const rounds = idx.length - 1;
  const matches: TournamentMatch[] = [];

  let id = 1;
  let arr = idx.slice();

  for (let r = 0; r < rounds; r++);
  {
    const half = arr.length / 2;
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[arr.length - 1 - i];
      if (a !== -1 && b !== -1) {
        matches.push({
          tournament_id: tournamentId,
          match_id: id++,
          player1_idx: a,
          player2_idx: b,
          played: false,
          score_p1: null,
          score_p2: null,
        });
      }
    }
    const fixed = arr[0];
    const tail = arr.slice(1);
    tail.unshift(tail.pop()!);
    arr = [fixed, ...tail];
  }
  return matches;
}

// UI

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, opts: { class?: string; text?: string } = {}, ...children: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (opts.class) n.className = opts.class;
  if (opts.text) n.textContent = opts.text;
  for (const c of children) if (c != null) n.append(c as any);
  return n;
}

export function statusDot(status: TournamentStatus) {
  const color = status === "registration" ? "bg-green-500" : status === "ongoing" ? "bg-red-500" : "bg-gray-400";
  return el("span", { class: `inline-block w-2.5 h-2.5 rounded-full ${color}` });
}

export function buildTournamentLayout() {
  const root = el("div", { class: "w-full h-full grid grid-cols-12 gap-4 p-4" });

  // Left column
  const left = el("div", { class: "col-span-5 space-y-4" });

  const createBtn = el(
    "button",
    { class: "w-full rounded-lg px-4 py-4 text-left text-white bg-emerald-600 hover:bg-emerald-500" },
    el("i", { class: "fa-solid fa-plus mr-5" }),
    el("span", { class: "font-semibold text-lg", text: "Create tournament" })
  );

  const listCard = el("div", { class: "px-6 py-4 flex flex-col gap-5 rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden " });
  const searchInput = h("input", {
    class: "mx-2 mt-1 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-100/70 " + "placeholder-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
    attributes: { placeholder: "Search owner…", type: "search" },
  }) as HTMLInputElement;

  const listHeader = el("div", { class: "flex items-center justify-between gap-2 text-emerald-700" }, el("h3", { class: "text-xl font-semibold", text: "Active tournaments" }), searchInput);

  const table = el("div", { class: "mt-2" });
  const tableHead = el(
    "div",
    { class: "grid grid-cols-12 text-md font-semibold uppercase text-emerald-600 px-2 py-1" },
    el("div", { class: "col-span-5", text: "Tournament" }),
    el("div", { class: "col-span-3", text: "Created by" }),
    el("div", { class: "col-span-2", text: "Players" }),
    el("div", { class: "col-span-2 text-right", text: "Status" })
  );
  const tableBody = el("div", { class: "flex flex-col gap-3" });
  const emptyMsg = el("div", { class: "text-sm text-zinc-500 px-2 py-3 hidden", text: "No available tournament yet. Create one by clicking on the button above" });
  table.append(tableHead, tableBody, emptyMsg);
  listCard.append(listHeader, table);

  // Right column
  const right = el("div", { class: "col-span-7" });
  const detailCard = el("div", { class: "p-4 h-full rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden " });

  const joinBtn = el("button", { class: "rounded-lg px-3 py-2 text-left text-white bg-emerald-600 hover:bg-emerald-500" }, el("span", { class: "font-semibold text-md", text: "Join tournament" }));

  const header = el(
    "div",
    { class: "flex items-center justify-between" },
    el("div", { class: "space-y-0.5" }, el("div", { class: "text-lg font-semibold", text: "Tournament" }), el("div", { class: "text-sm text-zinc-400", text: "created by —" })),
    joinBtn
  );
  //   const joinBtn = header.querySelector("button") as HTMLButtonElement;

  const body = el("div", { class: "mt-4 space-y-4" });

  detailCard.append(header, body);
  right.append(detailCard);

  root.append(left, right);
  left.append(createBtn, listCard);

  return {
    root,
    left: { createBtn, listCard, searchInput, tableBody, emptyMsg },
    right: { detailCard, header, joinBtn, body },
  };
}

export function tournamentRow(t: TournamentLite): HTMLElement {
  const row = el("button", { class: "w-full grid grid-cols-12 items-center px-2 py-2 hover:bg-emerald-200 text-left" });
  const name = el("div", { class: "col-span-5 font-medium truncate" }, t.title);
  const creator = el("div", { class: "col-span-3 text-sm text-zinc-300 truncate" }, t.created_by.pseudo);
  const players = el("div", { class: "col-span-2 text-sm" }, `${t.player_count}/${t.max_players}`);
  const status = el("div", { class: "col-span-2 text-right flex items-center justify-end gap-2" }, statusDot(t.status), el("span", { class: "text-xs" }, t.status));
  row.append(name, creator, players, status);
  return row;
}

export function playerLine(name: string, alias: string | null, editable: boolean, onAlias: (newAlias: string) => void) {
  const wrap = el("div", { class: "flex items-center gap-2" });
  wrap.append(el("div", { class: "w-40 truncate", text: name }));
  const input = h("input", {
    class: "mx-2 mt-1 px-2 py-1 rounded-xl border border-emerald-200 bg-emerald-100/70 " + "placeholder-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
    attributes: { placeholder: "Nickname" },
  }) as HTMLInputElement;

  input.placeholder = "Nickname";
  input.value = alias ?? "";
  input.disabled = !editable;
  input.addEventListener("change", () => onAlias(input.value));
  wrap.append(input);
  return wrap;
}

export function matchesPanel(matches: TournamentMatch[], players: TournamentPlayerSlot[], onPlay: (matchId: number) => void) {
  const list = el("div", { class: "space-y-1" });
  if (matches.length === 0) list.append(el("div", { class: "text-sm text-zinc-500", text: "No matches drafted yet." }));
  for (const m of matches) {
    const row = el("div", { class: "flex items-center justify-between px-2 py-1 rounded-md hover:bg-zinc-800/40" });
    const label = `${players[m.player1_idx].name} vs ${players[m.player2_idx].name}`;
    row.append(el("div", { class: "text-sm", text: label }));
    const right = el("div", { class: "flex items-center gap-2" });
    if (!m.played) {
      const btn = el("button", { class: "btn btn-sm rounded px-2 py-1", text: "Play" });
      btn.addEventListener("click", () => onPlay(m.match_id));
      right.append(btn);
    } else {
      right.append(el("span", { class: "text-xs text-zinc-400", text: `${m.score_p1}-${m.score_p2}` }));
    }
    row.append(right);
    list.append(row);
  }
  return list;
}

// Helpers

function labeledBlock(title: string, content: HTMLElement) {
  const wrap = document.createElement("div");
  wrap.className = "space-y-2";
  const h = document.createElement("div");
  h.className = "text-sm font-semibold";
  h.textContent = title;
  wrap.append(h, content);
  return wrap;
}

function rowEl(left: string, right: string) {
  const row = document.createElement("div");
  row.className = "flex items-center justify-between px-2 py-1 rounded-md hover:bg-zinc-800/40";
  row.append(el("div", { text: left }), el("div", { class: "text-sm text-zinc-400", text: right } as any));
  return row;
}

function buttonTab(label: string, active = false) {
  const b = document.createElement("button");
  b.className = "px-3 py-1.5 rounded-md border data-[active='1']:bg-zinc-800/60";
  b.textContent = label;
  if (active) b.dataset.active = "1";
  else b.dataset.active = "0";
  return b;
}

function h2(text: string) {
  const h = document.createElement("h2");
  h.className = "text-lg font-semibold";
  h.textContent = text;
  return h;
}

function formRow(label: string, field: HTMLElement) {
  const row = document.createElement("div");
  row.className = "grid grid-cols-3 items-center gap-3";
  const l = document.createElement("label");
  l.className = "text-sm text-zinc-300";
  l.textContent = label;
  const r = document.createElement("div");
  r.className = "col-span-2";
  r.append(field);
  row.append(l, r);
  return row;
}

function inputText(placeholder = "") {
  const i = document.createElement("input");
  i.type = "text";
  i.placeholder = placeholder;
  i.className = "input w-full px-3 py-2 rounded-md bg-transparent border";
  return i;
}

function inputNumber(min: number, max: number, value: number) {
  const i = document.createElement("input");
  i.type = "number";
  i.min = String(min);
  i.max = String(max);
  i.value = String(value);
  i.className = "input w-28 px-3 py-2 rounded-md bg-transparent border";
  return i;
}

function buttonPrimary(label: string) {
  const b = document.createElement("button");
  b.className = "btn btn-primary px-3 py-1.5 rounded-md";
  b.textContent = label;
  return b;
}

function buttonGhost(label: string) {
  const b = document.createElement("button");
  b.className = "btn px-3 py-1.5 rounded-md border";
  b.textContent = label;
  return b;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function computeRanking(t: TournamentFull) {
  const n = t.players.length;
  const wins = Array(n).fill(0);
  const losses = Array(n).fill(0);
  const points = Array(n).fill(0);
  for (const m of t.matches) {
    if (!m.played || m.score_p1 == null || m.score_p2 == null) continue;
    if (m.score_p1 > m.score_p2) {
      wins[m.player1_idx]++;
      losses[m.player2_idx]++;
    } else if (m.score_p2 > m.score_p1) {
      wins[m.player2_idx]++;
      losses[m.player1_idx]++;
    }
    points[m.player1_idx] += m.score_p1;
    points[m.player2_idx] += m.score_p2;
  }
  const rows = t.players.map((p, i) => ({ name: p.name, wins: wins[i], losses: losses[i], points: points[i] }));
  rows.sort((A, B) => B.wins - A.wins || B.points - A.points);
  return rows;
}

function defaultSettings(): MatchSettings {
  return {
    pointsToWin: 3,
    paddleHeight: "medium",
    freeMove: false,
    hostSide: "left",
  };
}

function rangeInput(min: number, max: number, value: number, onChange: (v: number) => void) {
  const i = document.createElement("input");
  i.type = "range";
  i.min = String(min);
  i.max = String(max);
  i.value = String(value);
  i.className = "w-full";
  i.addEventListener("input", () => onChange(parseInt(i.value)));
  return i;
}

function numberInput(min: number, max: number, value: number, onChange: (v: number) => void) {
  const i = document.createElement("input");
  i.type = "number";
  i.min = String(min);
  i.max = String(max);
  i.value = String(value);
  i.className = "input w-28 px-3 py-2 rounded-md bg-transparent border";
  i.addEventListener("change", () => onChange(parseInt(i.value || String(value))));
  return i;
}

function settingsBlock(s: MatchSettings) {
  const wrap = document.createElement("div");
  wrap.className = "rounded-xl border p-3 space-y-3";

  //   wrap.append(
  //     formRow(
  //       "Ball speed",
  //       rangeInput(1, 10, s.ballSpeed, (v) => (s.ballSpeed = v))
  //     ),
  //     formRow(
  //       "Paddle size",
  //       rangeInput(1, 10, s.paddleSize, (v) => (s.paddleSize = v))
  //     ),
  //     formRow(
  //       "Points to win",
  //       numberInput(1, 50, s.pointsToWin, (v) => (s.pointsToWin = v))
  //     )
  //   );

  return wrap;
}

// Entry point

export type TournamentUIState = {
  me: PublicUser | null;
  selected: TournamentFull | null;
  list: TournamentLite[];
  searchQ: string;
};

export function TournamentsView(root: HTMLElement) {
  const ui = buildTournamentLayout();
  root.replaceChildren(ui.root);

  let uiState: TournamentUIState = {
    me: null,
    selected: null,
    list: [],
    searchQ: "",
  };

  init();

  async function init() {
    uiState.me = await UsersAPI.getPublic(auth.get().meId!);
    await refreshList();
    wire();
  }

  function wire() {
    ui.left.createBtn.addEventListener("click", openCreateSplash);
    ui.left.searchInput.addEventListener("input", async () => {
      uiState.searchQ = ui.left.searchInput.value.trim();
      await refreshList();
    });
  }

  async function refreshList() {
    uiState.list = await TournamentsAPI.listActiveTournaments(uiState.searchQ);
    ui.left.tableBody.replaceChildren();
    if (uiState.list.length === 0) {
      ui.left.emptyMsg.classList.remove("hidden");
      return;
    } else {
      ui.left.emptyMsg.classList.add("hidden");
    }

    for (const t of uiState.list) {
      const row = tournamentRow(t);
      row.addEventListener("click", () => selectTournament(t.tournament_id));
      ui.left.tableBody.append(row);
    }
  }

  async function selectTournament(tournamentId: number) {
    uiState.selected = await TournamentsAPI.getTournament(tournamentId);
    renderDetail();
  }

  function renderDetail() {
    const t = uiState.selected;
    if (!t) return;

    // Header
    const title = ui.right.header.querySelector("div > div:first-child") as HTMLDivElement;
    const subtitle = ui.right.header.querySelector("div > div:last-child") as HTMLDivElement;
    title.textContent = t.title;
    subtitle.textContent = `created by ${t.owner.pseudo}`;

    // Join button visibility
    ui.right.joinBtn.disabled = !(t.status === "registration");
    ui.right.joinBtn.onclick = async () => {
      uiState.selected = await TournamentsAPI.joinTournament(t.tournament_id);
      renderDetail();
      await refreshList();
    };

    // Body
    ui.right.body.replaceChildren();

    if (t.status === "registration") {
      // Players + alias inputs
      const playersWrap = document.createElement("div");
      playersWrap.className = "space-y-2";

      t.players.forEach((p, idx) => {
        const canEdit = !!uiState.me && (uiState.me.id === t.owner.id || p.user_id === uiState.me.id);
        const line = playerLine(p.name, p.alias, canEdit, async (alias) => {
          uiState.selected = await TournamentsAPI.updateAlias(t.tournament_id, { index: idx, alias });
          renderDetail();
        });
        playersWrap.append(line);
      });

      ui.right.body.append(labeledBlock("Players (registration)", playersWrap), creatorControls(t));
    }

    if (t.status === "ongoing") {
      // Tabs: Matches / Ranking (simple toggle)
      const tabs = document.createElement("div");
      tabs.className = "flex gap-2";
      const mBtn = buttonTab("Matches", true);
      const rBtn = buttonTab("Ranking", false);
      tabs.append(mBtn, rBtn);

      const content = document.createElement("div");
      content.className = "mt-3";

      const showMatches = () => {
        content.replaceChildren(
          matchesPanel(t.matches, t.players, (matchId) => {
            // TODO: navigate to game view or trigger match start API
            console.log("play match", matchId);
          })
        );
      };

      const showRanking = () => {
        const table = document.createElement("div");
        table.className = "space-y-1";
        const scores = computeRanking(t);
        for (const row of scores) {
          table.append(rowEl(`${row.name}`, `${row.wins}W-${row.losses}L (${row.points} pts)`));
        }
        content.replaceChildren(table);
      };

      mBtn.onclick = () => {
        mBtn.dataset.active = "1";
        rBtn.dataset.active = "0";
        showMatches();
      };
      rBtn.onclick = () => {
        rBtn.dataset.active = "1";
        mBtn.dataset.active = "0";
        showRanking();
      };

      ui.right.body.append(tabs, content);
      showMatches();
    }
  }

  function creatorControls(t: TournamentFull) {
    const wrap = document.createElement("div");
    wrap.className = "mt-4 flex items-center justify-between";

    const left = document.createElement("div");
    left.className = "text-sm text-zinc-400";
    left.textContent = `Max players: ${t.max_players}`;

    const right = document.createElement("div");
    const canStart = !!uiState.me && uiState.me.id === t.owner.id;
    const startBtn = document.createElement("button");
    startBtn.className = "rounded-lg px-3 py-2 text-left font-semibold text-white bg-emerald-600 hover:bg-emerald-500";

    startBtn.textContent = "Start tournament";
    startBtn.disabled = !canStart || t.players.length < 2;

    startBtn.onclick = async () => {
      // Option A: let backend draft
      // selected = await api.startTournament(t.id);
      // Option B: draft client-side then POST (if your backend expects matches)
      const drafted = draftRound(t.tournament_id, t.players);
      // You might POST drafted matches here if your backend needs them
      uiState.selected = await TournamentsAPI.startTournament(t.tournament_id);
      // Refresh
      renderDetail();
      await refreshList();
    };

    right.append(startBtn);
    wrap.append(left, right);
    return wrap;
  }

  function openCreateSplash() {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50";

    const card = document.createElement("div");
    card.className = "w-full max-w-lg rounded-2xl border bg-zinc-900 p-4 space-y-4";

    const title = h2("Create tournament");

    const nameRow = formRow("Name", inputText("Give it a cool name"));
    const nameInput = nameRow.querySelector("input") as HTMLInputElement;

    const maxRow = formRow("Max players", inputNumber(2, 16, 8));
    const maxInput = maxRow.querySelector("input") as HTMLInputElement;

    const settings = defaultSettings();
    const settingsUI = settingsBlock(settings);

    const actions = document.createElement("div");
    actions.className = "flex items-center justify-end gap-2";
    const cancel = buttonGhost("Cancel");
    const create = buttonPrimary("Create");
    actions.append(cancel, create);

    card.append(title, nameRow, maxRow, settingsUI, actions);
    overlay.append(card);
    document.body.append(overlay);

    cancel.onclick = () => overlay.remove();
    create.onclick = async () => {
      const payload: CreateTournamentPayload = {
        name: (nameInput.value || "Untitled").trim(),
        maxPlayers: clamp(parseInt(maxInput.value || "8") || 8, 2, 16),
        settings: defaultSettings(),
      };
      uiState.selected = await TournamentsAPI.createTournament(payload);
      overlay.remove();
      await refreshList();
      renderDetail();
    };
  }
}
