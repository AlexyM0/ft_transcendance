// src/views/TournamentsView.ts
import { domElem as h, mount } from "../ui/DomElement";
import { Avatar } from "../ui/Avatar";
import { setPlayPreset } from "./PlayView";

/* =========================================================
   Types (UI-only; pure dummy data, no API)
========================================================= */
type Id = number;
type Player = { id: Id; alias: string; avatar: string | null };

type Source = { kind: "player"; playerId: Id } | { kind: "winner"; fromMatchId: Id } | { kind: "bye" } | { kind: "tbd" };

type MatchStatus = "pending" | "ready" | "in_progress" | "completed";
type Match = {
  id: Id;
  round: number; // 0-based
  order: number; // index within round
  left: Source; // may be player, bye, or "winner from match"
  right: Source;
  winnerId: Id | null;
  status: MatchStatus;
};

type Bracket = { rounds: Match[][] };

/* =========================================================
   Utilities
========================================================= */
// Layout: fit viewport (no page scroll), let inner areas scroll.
const GRID_COLS = "grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)_280px]";
const PANEL_FRAME =
  // Use 80vh minus the AppShell vertical padding (py-8 = 2rem top + 2rem bottom)
  "h-[calc(90vh-4rem)] m-0 rounded-2xl overflow-hidden border border-emerald-100 shadow bg-white";

function minw0<T extends HTMLElement>(el: T) {
  el.classList.add("min-w-0");
  return el;
}
function nextPow2(n: number) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function isPlayer(src: Source): src is { kind: "player"; playerId: Id } {
  return src.kind === "player";
}

/* =========================================================
   Dummy user pool (searchable) with stable IDs for persistence
========================================================= */
const stockAvatar = "/user.png";
function stableId(str: string) {
  let hsh = 0;
  for (let i = 0; i < str.length; i++) {
    hsh = (hsh << 5) - hsh + str.charCodeAt(i);
    hsh |= 0;
  }
  return Math.abs(hsh) + 1000;
}
function makeUser(alias: string): Player {
  return { id: stableId(alias), alias, avatar: stockAvatar };
}
const allUsers: Player[] = [
  "Ada Lovelace",
  "Alan Turing",
  "Grace Hopper",
  "Hedy Lamarr",
  "Barbara Liskov",
  "Edsger Dijkstra",
  "Donald Knuth",
  "Linus Torvalds",
  "Ken Thompson",
  "Dennis Ritchie",
  "Margaret Hamilton",
  "John Von Neumann",
].map(makeUser);

/* =========================================================
   Bracket logic (single-elim; dynamic resolution)
========================================================= */
function seedBracket(players: Player[]): Bracket {
  const pool = players.slice(0, 8); // cap at 8 for demo clarity
  const n = Math.max(pool.length, 2);
  const size = nextPow2(n);

  // Round 0 sources (players + byes)
  const slots: Source[] = [];
  for (let i = 0; i < size; i++) {
    if (i < pool.length) slots.push({ kind: "player", playerId: pool[i].id });
    else slots.push({ kind: "bye" });
  }

  const rounds: Match[][] = [];
  let idCounter = 1;

  // Round 0
  const r0: Match[] = [];
  for (let i = 0; i < size / 2; i++) {
    r0.push({
      id: idCounter++,
      round: 0,
      order: i,
      left: slots[i * 2] ?? { kind: "tbd" },
      right: slots[i * 2 + 1] ?? { kind: "tbd" },
      winnerId: null,
      status: "pending",
    });
  }
  rounds.push(r0);

  // Higher rounds: always reference winners of previous round
  let prev = r0;
  let roundIdx = 1;
  while (prev.length > 1) {
    const cur: Match[] = [];
    for (let j = 0; j < prev.length; j += 2) {
      cur.push({
        id: idCounter++,
        round: roundIdx,
        order: j / 2,
        left: { kind: "winner", fromMatchId: prev[j].id },
        right: { kind: "winner", fromMatchId: prev[j + 1].id },
        winnerId: null,
        status: "pending",
      });
    }
    rounds.push(cur);
    prev = cur;
    roundIdx++;
  }

  const bracket: Bracket = { rounds };
  autoAdvanceByes(bracket); // immediately bubble through **byes only**
  refreshStatuses(bracket); // compute ready/pending/completed
  return bracket;
}

// Resolve a Source into a concrete player (if upstream winner known)
function resolveSource(src: Source, bracket: Bracket): Source {
  if (src.kind !== "winner") return src;
  const m = findMatch(bracket, src.fromMatchId);
  return m?.winnerId ? { kind: "player", playerId: m.winnerId } : { kind: "tbd" };
}

function findMatch(bracket: Bracket, id: Id): Match | null {
  for (const round of bracket.rounds) {
    const m = round.find((x) => x.id === id);
    if (m) return m;
  }
  return null;
}

// Compute status based on resolvable players
function refreshStatuses(bracket: Bracket) {
  for (const round of bracket.rounds) {
    for (const m of round) {
      if (m.winnerId) {
        m.status = "completed";
        continue;
      }
      const L = resolveSource(m.left, bracket);
      const R = resolveSource(m.right, bracket);
      const leftReady = isPlayer(L);
      const rightReady = isPlayer(R);
      // keep "in_progress" if still valid
      if (m.status === "in_progress" && !m.winnerId) {
        m.status = leftReady && rightReady ? "in_progress" : "pending";
      } else {
        m.status = leftReady && rightReady ? "ready" : "pending";
      }
    }
  }
}

/**
 * Auto-advance **only** when facing an explicit BYE in the same match.
 * (Do NOT treat 'tbd' as a bye; that represents an unresolved upstream winner.)
 * This prevents a semifinal winner from auto-winning the final when the other
 * semifinal isn't decided yet, and fixes the 3-player bracket edge case.
 */
function autoAdvanceByes(bracket: Bracket) {
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const round of bracket.rounds) {
      for (const m of round) {
        if (m.winnerId) continue;
        const L = resolveSource(m.left, bracket);
        const R = resolveSource(m.right, bracket);
        const leftP = isPlayer(L) ? L.playerId : null;
        const rightP = isPlayer(R) ? R.playerId : null;
        const leftIsBye = L.kind === "bye";
        const rightIsBye = R.kind === "bye";
        if ((leftP && rightIsBye) || (rightP && leftIsBye)) {
          m.winnerId = leftP ?? rightP!;
          m.status = "completed";
          progressed = true;
        }
      }
    }
    if (progressed) refreshStatuses(bracket);
  }
}

function setWinner(bracket: Bracket, match: Match, playerId: Id) {
  match.winnerId = playerId;
  match.status = "completed";
  refreshStatuses(bracket);
  autoAdvanceByes(bracket);
}

function clearWinner(bracket: Bracket, match: Match) {
  match.winnerId = null;
  refreshStatuses(bracket);
}

function readyQueue(bracket: Bracket): Match[] {
  const q: Match[] = [];
  bracket.rounds.forEach((round) =>
    round.forEach((m) => {
      if (m.status === "ready") q.push(m);
    })
  );
  q.sort((a, b) => a.round - b.round || a.order - b.order);
  return q;
}

function findPlayer(players: Player[], id: Id | null | undefined) {
  return players.find((p) => p.id === id) ?? { id: -1, alias: "TBD", avatar: null };
}

function nameOf(players: Player[], id: Id | null | undefined) {
  return players.find((p) => p.id === id)?.alias ?? "TBD";
}

/* =========================================================
   Persistence (localStorage)
========================================================= */
const LS_KEY = "pong_tournament_v1";

function saveState(state: { players: Player[]; bracket: Bracket | null; selectedMatchId: Id | null; query: string }) {
  const payload = {
    players: state.players,
    bracket: state.bracket,
    selectedMatchId: state.selectedMatchId,
    query: state.query,
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {}
}

function loadState(): { players: Player[]; bracket: Bracket | null; selectedMatchId: Id | null; query: string } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const players = Array.isArray(data.players) ? (data.players as Player[]) : [];
    const bracket = data.bracket as Bracket | null;
    const selectedMatchId = typeof data.selectedMatchId === "number" || data.selectedMatchId === null ? data.selectedMatchId : null;
    const query = typeof data.query === "string" ? data.query : "";
    if (bracket) {
      refreshStatuses(bracket);
      autoAdvanceByes(bracket);
    }
    return { players, bracket, selectedMatchId, query };
  } catch {
    return null;
  }
}

/* =========================================================
   View
========================================================= */
export function TournamentsView(root: HTMLElement) {
  const loaded = loadState();

  const state = {
    players: loaded?.players ?? ([] as Player[]),
    bracket: loaded?.bracket ?? (null as Bracket | null),
    selectedMatchId: loaded?.selectedMatchId ?? (null as Id | null),
    query: loaded?.query ?? "",
  };

  /* ---------------- Left Panel: Search + Roster + Cancel ---------------- */
  function LeftPanel() {
    const box = h("aside", { class: "bg-emerald-50 border-r border-emerald-100 p-4 flex flex-col gap-3 h-full overflow-hidden" });

    const title = h("div", { class: "text-emerald-900 font-semibold", text: "Tournament" });
    const sub = h("div", { class: "text-emerald-900/70 text-sm", text: "Registration via user search" });

    // Search
    const search = h("input", {
      class: "px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-100/70 placeholder-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
      attributes: { placeholder: "Search users…", type: "search", autocomplete: "off" },
    }) as HTMLInputElement;
    search.value = state.query;

    const results = h("div", { class: "max-h-40 overflow-auto space-y-1" });

    function resultRow(u: Player) {
      const already = state.players.some((p) => p.id === u.id);
      const full = state.players.length >= 8;
      const row = h("button", {
        class: "w-full flex items-center gap-2 px-2 py-1 rounded transition " + (already || full ? "opacity-60 cursor-not-allowed" : "hover:bg-emerald-100/60"),
        attributes: { type: "button" },
      });
      row.append(
        Avatar(u.avatar, 24),
        h("span", { class: "truncate text-emerald-900", text: u.alias }),
        h("span", { class: "ml-auto text-xs text-emerald-800/70", text: already ? "Added" : full ? "Full" : "Add" })
      );
      row.addEventListener("click", () => {
        if (already || full) return;
        state.players.push(u);
        state.bracket = null;
        state.selectedMatchId = null;
        renderRoster();
        renderResults();
        saveState(state);
        right.render();
        center.render();
      });
      return row;
    }

    function renderResults() {
      results.replaceChildren();
      const q = search.value.trim().toLowerCase();
      if (!q) {
        results.append(h("div", { class: "text-emerald-900/60 text-sm px-1", text: "" }));
        return;
      }
      const list = allUsers.filter((u) => u.alias.toLowerCase().includes(q)).slice(0, 12);
      if (list.length === 0) {
        results.append(h("div", { class: "text-emerald-900/60 text-sm px-1", text: "No users match." }));
        return;
      }
      list.forEach((u) => results.append(resultRow(u)));
    }
    search.addEventListener("input", () => {
      state.query = search.value;
      renderResults();
      saveState(state);
    });

    // Roster (selected players)
    const rosterHeader = h("div", { class: "mt-2 text-emerald-900/70 text-sm" });
    const roster = h("div", { class: "flex-1 overflow-auto space-y-2 pr-1" });

    function rosterRow(p: Player) {
      const row = h("div", { class: "flex items-center gap-3 px-3 py-2 rounded-xl bg-emerald-100/50" });
      row.append(Avatar(p.avatar, 28));
      row.append(h("div", { class: "font-medium text-emerald-900 truncate", text: p.alias }));
      const remove = h("button", { class: "ml-auto text-rose-700 hover:text-rose-600", attributes: { type: "button", title: "Remove" } });
      remove.append(h("i", { class: "fa-solid fa-xmark" }));
      remove.addEventListener("click", () => {
        state.players = state.players.filter((x) => x.id !== p.id);
        state.bracket = null;
        state.selectedMatchId = null;
        renderRoster();
        renderResults();
        saveState(state);
        right.render();
        center.render();
      });
      row.append(remove);
      return row;
    }

    const actions = h("div", { class: "grid grid-cols-3 gap-2" });
    const seedBtn = h("button", { class: "px-3 py-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-40", attributes: { type: "button" }, text: "Seed" });
    const shuffleBtn = h("button", { class: "px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40", attributes: { type: "button" }, text: "Shuffle" });
    const resetBtn = h("button", { class: "px-3 py-2 rounded-xl bg-emerald-200 text-emerald-900 hover:bg-emerald-100 disabled:opacity-40", attributes: { type: "button" }, text: "Clear" });
    const cancelBtn = h("button", { class: "mt-2 px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-40", attributes: { type: "button" }, text: "Cancel tournament" });

    seedBtn.addEventListener("click", () => {
      state.bracket = seedBracket(state.players);
      state.selectedMatchId = null;
      saveState(state);
      renderRoster();
      center.render();
      right.render();
    });
    shuffleBtn.addEventListener("click", () => {
      state.players = shuffle(state.players);
      state.bracket = null;
      state.selectedMatchId = null;
      renderRoster();
      saveState(state);
      center.render();
      right.render();
    });
    resetBtn.addEventListener("click", () => {
      state.players = [];
      state.bracket = null;
      state.selectedMatchId = null;
      search.value = "";
      renderResults();
      renderRoster();
      saveState(state);
      center.render();
      right.render();
    });
    // Cancel = clear bracket only (keep roster)
    cancelBtn.addEventListener("click", () => {
      state.bracket = null;
      state.selectedMatchId = null;
      saveState(state);
      renderRoster();
      center.render();
      right.render();
    });

    function renderRoster() {
      roster.replaceChildren();
      rosterHeader.textContent = `Selected players (${state.players.length}/8)`;
      if (state.players.length === 0) {
        roster.append(h("div", { class: "text-emerald-900/60", text: "No players yet. Add up to 8." }));
      } else {
        state.players.slice(0, 8).forEach((p) => roster.append(rosterRow(p)));
        if (state.players.length > 8) {
          roster.append(h("div", { class: "text-emerald-900/60 text-sm", text: "Only first 8 will be seeded." }));
        }
      }
      const canSeed = (state.players.length === 2 || state.players.length === 4 || state.players.length === 8) && state.bracket == null;
      const canShuffle = state.players.length > 2 && state.bracket == null;
      const canReset = state.players.length !== 0 && state.bracket == null;
      seedBtn.toggleAttribute("disabled", !canSeed);
      shuffleBtn.toggleAttribute("disabled", !canShuffle);
      resetBtn.toggleAttribute("disabled", !canReset);
      cancelBtn.toggleAttribute("disabled", state.bracket == null);
    }

    mount(actions, seedBtn, shuffleBtn, resetBtn);
    mount(box, title, sub, search, results, rosterHeader, roster, actions, cancelBtn);

    // initial
    renderResults();
    renderRoster();

    return { el: box, renderRoster, renderResults };
  }

  /* ---------------- Center Panel: Bracket + Final Summary ---------------- */
  function statusBadge(status: MatchStatus) {
    const palette =
      status === "completed"
        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
        : status === "in_progress"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : status === "ready"
        ? "bg-indigo-100 text-indigo-700 border-indigo-200"
        : "bg-slate-100 text-slate-600 border-slate-200"; // pending
    return h("span", { class: `px-2 py-0.5 rounded-full text-[11px] border ${palette}`, text: status.replace("_", " ") });
  }

  function matchCard(m: Match) {
    const isSelected = state.selectedMatchId === m.id;

    const L = state.bracket ? resolveSource(m.left, state.bracket) : ({ kind: "tbd" } as Source);
    const R = state.bracket ? resolveSource(m.right, state.bracket) : ({ kind: "tbd" } as Source);

    const card = h("button", {
      class:
        "w-full text-left px-3 py-2 rounded-xl border transition " +
        (m.status === "ready" ? "border-indigo-300 ring-2 ring-indigo-100 bg-indigo-50/40" : "border-slate-200 hover:bg-slate-50") +
        (isSelected ? " outline outline-2 outline-indigo-400" : ""),
      attributes: { type: "button", "aria-current": isSelected ? "true" : "false" },
    });

    const head = h("div", { class: "mb-1 flex items-center justify-between" });
    head.append(h("div", { class: "text-[11px] text-slate-500", text: `Round ${m.round + 1} • Match ${m.order + 1}` }), statusBadge(m.status));

    const leftWon = m.winnerId && isPlayer(L) && m.winnerId === L.playerId;
    const rightWon = m.winnerId && isPlayer(R) && m.winnerId === R.playerId;

    const leftRow = h("div", { class: "flex items-center gap-2" });
    leftRow.append(
      h("div", { class: "w-2 h-2 rounded-full " + (isPlayer(L) ? "bg-emerald-500" : "bg-slate-300") }),
      h("div", { class: "truncate break-all", text: isPlayer(L) ? nameOf(state.players, L.playerId) : L.kind === "bye" ? "— BYE —" : "TBD" })
    );
    if (leftWon) leftRow.classList.add("text-emerald-700", "font-semibold");

    const rightRow = h("div", { class: "flex items-center gap-2" });
    rightRow.append(
      h("div", { class: "w-2 h-2 rounded-full " + (isPlayer(R) ? "bg-emerald-500" : "bg-slate-300") }),
      h("div", { class: "truncate break-all", text: isPlayer(R) ? nameOf(state.players, R.playerId) : R.kind === "bye" ? "— BYE —" : "TBD" })
    );
    if (rightWon) rightRow.classList.add("text-emerald-700", "font-semibold");

    mount(card, head, leftRow, rightRow);

    card.addEventListener("click", () => {
      state.selectedMatchId = m.id;
      saveState(state);
      center.render();
      right.render();
    });

    return card;
  }

  function CenterPanel() {
    const box = minw0(h("section", { class: "bg-white flex flex-col h-full" }));
    const head = h("div", { class: "h-14 px-4 border-b border-slate-100 flex items-center gap-3" });
    head.append(h("div", { class: "font-semibold text-slate-800", text: "Tournament • Single Elimination" }));
    head.append(h("div", { class: "text-slate-400 text-sm", text: "Select a match to manage" }));

    const scroller = minw0(h("div", { class: "flex-1 overflow-auto p-4" }));

    function finalSummary() {
      if (!state.bracket) return null;
      const lastRound = state.bracket.rounds[state.bracket.rounds.length - 1];
      if (!lastRound || lastRound.length === 0) return null;
      const final = lastRound[0];
      if (!(final && final.status === "completed" && final.winnerId)) return null;

      const winnerAlias = nameOf(state.players, final.winnerId);
      const wrap = h("div", { class: "mt-4 p-4 rounded-2xl border border-amber-200 bg-amber-50" });

      const title = h("div", { class: "text-xl font-semibold text-amber-800" });
      title.textContent = `🏆 Winner: ${winnerAlias}`;

      const buttons = h("div", { class: "mt-3 flex gap-2" });
      const restart = h("button", {
        class: "px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500",
        attributes: { type: "button" },
        text: "Restart same tournament",
      });
      const clearAll = h("button", {
        class: "px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-500",
        attributes: { type: "button" },
        text: "Clear panel",
      });

      restart.addEventListener("click", () => {
        state.bracket = seedBracket(state.players);
        state.selectedMatchId = null;
        saveState(state);
        center.render();
        right.render();
      });

      clearAll.addEventListener("click", () => {
        state.players = [];
        state.bracket = null;
        state.selectedMatchId = null;
        saveState(state);
        left.renderResults();
        left.renderRoster();
        center.render();
        right.render();
      });

      mount(buttons, restart, clearAll);
      mount(wrap, title, buttons);
      return wrap;
    }

    function render() {
      scroller.replaceChildren();
      if (!state.bracket) {
        scroller.append(h("div", { class: "text-slate-400 text-center mt-16", text: "Seed the bracket from the left panel to begin." }));
        return;
      }

      const cols = h("div", { class: "grid gap-4", attributes: { style: "grid-auto-flow: column;" } });
      state.bracket.rounds.forEach((round, idx) => {
        const col = minw0(h("div", { class: "min-w-[240px] space-y-3" }));
        col.append(h("div", { class: "text-xs font-semibold text-slate-500", text: `Round ${idx + 1}` }));
        round.forEach((m) => col.append(matchCard(m)));
        cols.append(col);
      });
      scroller.append(cols);

      const summary = finalSummary();
      if (summary) scroller.append(summary);
    }

    mount(box, head, scroller);
    render();
    return { el: box, render };
  }

  /* ---------------- Right Panel: Selected + Queue ---------------- */
  function RightPanel() {
    const box = h("aside", { class: "bg-emerald-50 border-l border-emerald-100 p-4 flex flex-col h-full overflow-hidden min-w-0" });

    const selHead = h("div", { class: "text-emerald-900 font-semibold", text: "Selected match" });
    const selBody = h("div", { class: "mt-2 rounded-xl bg-emerald-100/50 p-3" });

    function selectedUI() {
      selBody.replaceChildren();
      if (!state.bracket || state.selectedMatchId == null) {
        selBody.append(h("div", { class: "text-emerald-900/60", text: "None selected." }));
        return;
      }
      const m = findMatch(state.bracket, state.selectedMatchId)!;
      const L = resolveSource(m.left, state.bracket);
      const R = resolveSource(m.right, state.bracket);

      const lPlayer: Player = isPlayer(L) ? findPlayer(state.players, L.playerId) : { id: -1, alias: "TBD", avatar: null };
      const rPlayer: Player = isPlayer(R) ? findPlayer(state.players, R.playerId) : { id: -1, alias: "TBD", avatar: null };

      const title = h("div", { class: "text-sm text-emerald-900/80 mb-1", text: `Round ${m.round + 1} • Match ${m.order + 1}` });
      const rows = h("div", { class: "space-y-2" });
      const row = (label: string) => h("div", { class: "px-3 py-2 rounded-lg bg-white/70 border border-emerald-100 truncate break-all", text: label });
      rows.append(row(lPlayer.alias), row(rPlayer.alias));

      // Actions: enable when logical
      const actions = h("div", { class: "mt-3 flex flex-col gap-2" });
      const make = (label: string, icon: string, tone: "green" | "red" | "indigo") => {
        const toneCls = tone === "green" ? "text-emerald-700 hover:bg-emerald-100/60" : tone === "red" ? "text-rose-700 hover:bg-rose-100/60" : "text-indigo-700 hover:bg-indigo-100/60";
        const btn = h("button", {
          class: `w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${toneCls} disabled:opacity-40`,
          attributes: { type: "button" },
        });
        btn.append(h("i", { class: `fa-solid ${icon} text-sm` }), h("span", { class: "font-medium", text: label }));
        return btn;
      };

      const readyOrInProg = m.status === "ready" || m.status === "in_progress";
      const start = make(m.status === "in_progress" ? "Resume match" : "Start match", "fa-play", "indigo");
      const winL = make(`Set winner: ${lPlayer.alias}`, "fa-trophy", "green");
      const winR = make(`Set winner: ${rPlayer.alias}`, "fa-trophy", "green");
      const clear = make("Clear result", "fa-undo", "red");

      start.toggleAttribute("disabled", !readyOrInProg);
      winL.toggleAttribute("disabled", !(isPlayer(L) && readyOrInProg));
      winR.toggleAttribute("disabled", !(isPlayer(R) && readyOrInProg));
      clear.toggleAttribute("disabled", m.winnerId == null);

      start.addEventListener("click", () => {
        if (m.status === "ready") {
          m.status = "in_progress";
          refreshStatuses(state.bracket!);
          saveState(state);
          right.render();
          center.render();
          const p1 = { id: lPlayer.id, alias: lPlayer.alias, avatar: lPlayer.avatar };
          const p2 = { id: rPlayer.id, alias: rPlayer.alias, avatar: rPlayer.avatar };

          setPlayPreset({ kind: "tournament", p1, p2 });
          window.location.hash = "#/play";
        } else if (m.status === "in_progress") {
          window.location.hash = "#/play";
        }
      });
      winL.addEventListener("click", () => {
        if (isPlayer(L)) {
          setWinner(state.bracket!, m, L.playerId);
          saveState(state);
          right.render();
          center.render();
        }
      });
      winR.addEventListener("click", () => {
        if (isPlayer(R)) {
          setWinner(state.bracket!, m, R.playerId);
          saveState(state);
          right.render();
          center.render();
        }
      });
      clear.addEventListener("click", () => {
        clearWinner(state.bracket!, m);
        saveState(state);
        right.render();
        center.render();
      });

      actions.append(start, winL, winR, clear);
      selBody.append(title, rows, actions);
    }

    const queueHead = h("div", { class: "mt-4 text-emerald-900 font-semibold", text: "Next up" });
    const queueBody = h("div", { class: "mt-2 flex-1 overflow-auto space-y-2" });

    function renderQueue() {
      queueBody.replaceChildren();
      if (!state.bracket) {
        queueBody.append(h("div", { class: "text-emerald-900/60", text: "Seed a bracket to see upcoming matches." }));
        return;
      }
      const q = readyQueue(state.bracket);
      if (q.length === 0) {
        queueBody.append(h("div", { class: "text-emerald-900/60", text: "No ready matches yet." }));
        return;
      }
      q.forEach((m) => {
        const L = resolveSource(m.left, state.bracket!);
        const R = resolveSource(m.right, state.bracket!);
        const row = h("button", {
          class: "w-full text-left px-3 py-2 rounded-lg bg-white/70 border border-emerald-100 text-emerald-900/90 text-sm hover:bg-emerald-100/60",
          attributes: { type: "button" },
        });
        row.textContent = `R${m.round + 1} • M${m.order + 1}: ${isPlayer(L) ? nameOf(state.players, L.playerId) : "TBD"} vs ${isPlayer(R) ? nameOf(state.players, R.playerId) : "TBD"}`;
        row.addEventListener("click", () => {
          state.selectedMatchId = m.id;
          saveState(state);
          right.render();
          center.render();
        });
        queueBody.append(row);
      });
    }

    function render() {
      box.replaceChildren(selHead, selBody, queueHead, queueBody);
      selectedUI();
      renderQueue();
    }

    render();
    return { el: box, render };
  }

  /* ---------------- Assemble layout ---------------- */
  const wrap = h("div", { class: `${PANEL_FRAME} ${GRID_COLS}` });

  const left = LeftPanel();
  const center = CenterPanel();
  const right = RightPanel();

  mount(wrap, left.el, center.el, right.el);
  root.replaceChildren(wrap);

  return () => {};
}
