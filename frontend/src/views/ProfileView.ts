// src/views/ProfileView.ts
import { domElem as h, mount } from "../ui/DomElement";
import { createSplashScreen } from "../ui/SplashScreen";
import { ProfileEditForm, type ProfileEditInitial, type ProfileEditPayload } from "./ProfileEditForm";

// --- Types (shape your backend to these, or tweak below) ---
type Id = number;
type ProfileUser = {
  id: Id;
  pseudo: string;
  email: string;
  avatarUrl: string | null;
  twofaEnabled: boolean;
};
type MatchResult = { me: number; opp: number };
type LatestMatch = {
  me: { name: string; avatar: string; score: number };
  opponent: { name: string; avatar: string; score: number };
} | null;
type Stats = { won: number; winrate: number; tournaments: { win: number; loss: number } };

type OverviewResponse = {
  user: ProfileUser;
  matchHistory: MatchResult[]; // recent matches for the squares
  latestMatch: LatestMatch; // last match detail row
};

// --- Minimal API wrappers (adapt endpoints quickly here) ---
async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
async function apiPost<T>(url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
async function apiPut<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
async function apiUpload<T>(url: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("avatar", file);
  const res = await fetch(url, { method: "POST", credentials: "include", body: fd });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Centralized API used by this view
const ProfileAPI = {
  // One heavy join (user + last match + history)
  getOverview(userId: Id | "me"): Promise<OverviewResponse> {
    // Adjust to your backend, e.g. /api/users/:id/overview
    const id = userId === "me" ? "me" : String(userId);
    return apiGet(`/api/users/${id}`);
  },
  // A second call just for stats
  getStats(userId: Id | "me"): Promise<Stats> {
    const id = userId === "me" ? "me" : String(userId);
    return apiGet(`/api/users/${id}/stats`);
  },
  // Edit operations for ME only
  updateMeProfile(payload: { pseudo?: string; email?: string }): Promise<{ ok: true; user: ProfileUser }> {
    return apiPut(`/api/users/me`, payload);
  },
  uploadMyAvatar(file: File): Promise<{ ok: true; avatarUrl: string }> {
    return apiUpload(`/api/users/me/avatar`, file);
  },
  deleteMyAvatar(): Promise<{ ok: true }> {
    return apiDelete(`/api/users/me/avatar`);
  },
  // 2FA
  begin2fa: () => apiPost<{ otpauth: string; qrDataUrl: string }>(`/api/auth/2fa/setup`),
  verify2faSetup: (code: string) => apiPost<{ success: true }>(`/api/auth/2fa/verify`, { code }),
  // If you don't have this endpoint yet, add it server-side
  disable2fa: () => apiPost<{ success: true }>(`/api/auth/2fa/disable`),
};

const DEFAULT_AVATAR = "/user.png";
const TITLE_CLASSES = "text-teal-600 text-lg font-extrabold";
const CARD_CLASSES = "rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden";

function Card(title: string, opts?: { minH?: string; contentClass?: string }) {
  const { minH = "min-h-28", contentClass = "" } = opts ?? {};
  const box = h("section", { class: CARD_CLASSES + " flex flex-col" });
  const header = h("h2", { class: TITLE_CLASSES + " p-4 pb-2", text: title });
  const slot = h("div", { class: `h-full grid place-items-center ${minH} p-4 ${contentClass}` });
  mount(box, header, slot);
  return { box, slot };
}

/* ---------------- Cards that accept data + expose update() ---------------- */
function MatchHistoryCard() {
  const { box, slot } = Card("Match History", { minH: "min-h-24" });
  function render(items: MatchResult[]) {
    slot.replaceChildren();
    if (!items.length) {
      slot.append(h("div", { class: "text-slate-400 text-lg", text: "No match to display yet." }));
      return;
    }
    const row = h("div", { class: "flex flex-wrap items-center justify-center gap-4" });
    items.forEach(({ me, opp }) => {
      const win = me > opp;
      const colors = win ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-600" : "bg-rose-200 border-rose-500/40 text-rose-600";
      const box = h("div", {
        class: `w-14 h-16 py-1 rounded-md border ${colors} flex flex-col items-center justify-around leading-none select-none font-bold`,
      });
      mount(box, h("div", { text: String(me) }), h("div", { text: String(opp) }));
      row.append(box);
    });
    slot.append(row);
  }
  return { el: box, update: render };
}

function WinrateCard() {
  const { box, slot } = Card("Winning Rate", { minH: "min-h-24" });
  function render(s: Stats | null) {
    slot.replaceChildren();
    if (!s) {
      slot.append(h("div", { class: "text-slate-400", text: "—" }));
      return;
    }
    const wrap = h("div", { class: "flex flex-col text-center" });
    mount(wrap, h("div", { class: "font-extrabold text-2xl text-teal-600", text: `${s.won} games won` }), h("div", { class: "text-xl text-slate-400", text: `(${Math.round(s.winrate * 100)}%)` }));
    slot.append(wrap);
  }
  return { el: box, update: render };
}

function TournamentsStatsCard() {
  const { box, slot } = Card("Tournaments Stats", { minH: "min-h-24" });
  function render(s: Stats | null) {
    slot.replaceChildren();
    if (!s) {
      slot.append(h("div", { class: "text-slate-400", text: "—" }));
      return;
    }
    const wrap = h("div", { class: "flex flex-row justify-around items-center gap-12" });
    const mk = (val: number, cls: string) =>
      mount(h("div", { class: `${cls} w-10 h-14 py-1 rounded-md border font-bold flex justify-center items-center` }), h("div", { text: String(val) })).parentElement!;
    wrap.append(mk(s.tournaments.win, "bg-emerald-600/20 border-emerald-500/40 text-emerald-600"), mk(s.tournaments.loss, "bg-rose-200 border-rose-500/40 text-rose-600"));
    slot.append(wrap);
  }
  return { el: box, update: render };
}

function LatestMatchCard() {
  const { box, slot } = Card("Latest Match", { minH: "min-h-10" });
  function render(latest: LatestMatch) {
    slot.replaceChildren();
    if (!latest) {
      slot.append(h("div", { class: "text-slate-400 text-lg", text: "None has played yet." }));
      return;
    }
    const wrap = h("div", { class: "mx-auto w-full max-w-md flex flex-col gap-2" });
    const didWin = latest.me.score > latest.opponent.score;
    const badge = h("div", {
      class: "w-5 h-5 rounded text-xs flex items-center justify-center " + (didWin ? "bg-emerald-600/70 text-white" : "bg-rose-600/70 text-white"),
      text: didWin ? "W" : "L",
    });
    const row = (player: { name: string; avatar: string; score: number }, b?: HTMLElement) => {
      const r = h("div", { class: "flex justify-between items-center w-full" });
      const left = h("div", { class: "flex items-center gap-5" });
      const av = h("img", { class: "w-8 h-8 rounded-full object-cover", attributes: { src: player.avatar, alt: player.name } });
      mount(left, av, h("div", { class: "truncate text-teal-600 font-medium", text: player.name }));
      const right = h("div", { class: "flex items-center gap-2" });
      mount(right, h("div", { class: "w-6 text-right font-semibold [font-variant-numeric:tabular-nums]", text: String(player.score) }), b ?? h("div", { class: "w-5 h-5" }));
      mount(r, left, right);
      return r;
    };
    mount(wrap, row(latest.me, badge), row(latest.opponent));
    slot.append(wrap);
  }
  return { el: box, update: render };
}

function ProfileCard() {
  const box = h("div", { class: "rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden flex flex-col" });
  const header = h("div", { class: "h-44 sm:h-60 bg-gradient-to-r from-teal-700 to-emerald-300 p-4 flex flex-col justify-center items-center gap-6" });
  const avatar = h("img", { class: "w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ring-white/70 object-cover", attributes: { src: DEFAULT_AVATAR, alt: "avatar" } }) as HTMLImageElement;
  const uname = h("div", { class: "text-white font-semibold text-lg sm:text-xl", text: "Pseudo" });
  mount(header, avatar, uname);

  const body = h("div", { class: "p-6 flex-1 flex flex-col gap-4" });

  const row = (label: string, valueEl: HTMLElement) => {
    const R = h("div", { class: "flex items-center justify-between" });
    mount(R, h("span", { class: "text-lg text-zinc-400", text: label }), valueEl);
    return R;
  };

  const emailValue = h("span", { class: "text-lg font-medium text-teal-600 truncate max-w-[60%] text-right", text: "—" });
  const twofaBadge = h("span", { class: "inline-flex items-center px-2 py-0.5 rounded-full text-lg border", text: "Disabled" });
  const BADGE_ON = "border-emerald-500/50 text-emerald-500 bg-emerald-600/15";
  const BADGE_OFF = "border-rose-600 text-rose-600 bg-rose-200";
  twofaBadge.className = twofaBadge.className + " " + BADGE_OFF;

  const spacer = h("div", { class: "flex-1" });
  const editBtn = h("button", { class: "text-gray-400 hover:text-teal-600 text-lg font-bold mouse-pointer", text: "Edit profile" });

  mount(body, row("Email", emailValue), row("2FA", twofaBadge), spacer);

  const splash = createSplashScreen("Edit Profile");
  document.body.appendChild(splash.backdrop);
  editBtn.addEventListener("click", () => openEdit());

  function set2fa(enabled: boolean) {
    twofaBadge.textContent = enabled ? "Enabled" : "Disabled";
    twofaBadge.classList.remove(...BADGE_ON.split(" "), ...BADGE_OFF.split(" "));
    twofaBadge.classList.add(...(enabled ? BADGE_ON : BADGE_OFF).split(" "));
  }

  function openEdit(initial?: ProfileEditInitial) {
    const init: ProfileEditInitial = initial ?? {
      pseudo: uname.textContent || "",
      email: emailValue.textContent || "",
      avatarUrl: avatar.src || DEFAULT_AVATAR,
      twofaEnabled: twofaBadge.textContent === "Enabled",
    };

    const form = ProfileEditForm(init, {
      async onSubmit(payload) {
        // Avatar
        if (payload.deleteAvatar) await ProfileAPI.deleteMyAvatar();
        if (payload.avatarFile) await ProfileAPI.uploadMyAvatar(payload.avatarFile);

        // Profile fields
        const fields: { pseudo?: string; email?: string } = {};
        if (payload.pseudo !== undefined) fields.pseudo = payload.pseudo;
        if (payload.email !== undefined) fields.email = payload.email;
        if (Object.keys(fields).length) {
          const { user } = await ProfileAPI.updateMeProfile(fields);
          // reflect new values
          uname.textContent = user.pseudo;
          emailValue.textContent = user.email;
          avatar.src = user.avatarUrl ?? DEFAULT_AVATAR;
        }

        splash.close();
        form.dispose();
      },
      onCancel() {
        splash.close();
        form.dispose();
      },
      async on2faToggle(next) {
        if (next === "enable") {
          const setup = await ProfileAPI.begin2fa(); // { qrDataUrl, otpauth }
          return setup; // form will render QR + code box
        } else {
          await ProfileAPI.disable2fa();
          set2fa(false);
          return { disabled: true as const };
        }
      },
      async on2faVerify(code) {
        await ProfileAPI.verify2faSetup(code);
        set2fa(true);
        return { success: true as const };
      },
    });

    splash.setContent(form.wrap);
    splash.open();
  }

  function update(u: Partial<ProfileUser> & { isMe?: boolean }) {
    if (u.pseudo !== undefined) uname.textContent = u.pseudo ?? "Pseudo";
    if (u.email !== undefined) emailValue.textContent = u.email ?? "email@example.com";
    if (u.avatarUrl !== undefined) avatar.src = u.avatarUrl ?? DEFAULT_AVATAR;
    if (u.twofaEnabled !== undefined) set2fa(u.twofaEnabled);
    // Hide edit + 2FA badge for other users
    if (u.isMe !== undefined) {
      if (u.isMe) {
        if (!editBtn.isConnected) body.append(editBtn);
        twofaBadge.parentElement!.classList.remove("hidden");
      } else {
        editBtn.remove();
        twofaBadge.parentElement!.classList.add("hidden");
      }
    }
  }

  mount(box, header, body);
  return { el: box, update };
}

/* ---------------- Main exported view ---------------- */
// Reusable for me or any user
export async function ProfileView(root: HTMLElement, userId: Id | "me" = "me") {
  const state = {
    isMe: true,
    overview: null as OverviewResponse | null,
    stats: null as Stats | null,
  };

  console.log(state);
  root.className = "grid grid-cols-8 grid-rows-5 gap-3 px-8 py-12";

  // Build cards
  const matchHistory = MatchHistoryCard();
  const winRate = WinrateCard();
  const tournamentsStats = TournamentsStatsCard();
  const latestMatch = LatestMatchCard();
  const profileCard = ProfileCard();

  // Layout classes
  matchHistory.el.className += " col-span-4 row-span-1";
  profileCard.el.className += " col-span-4 row-span-4";
  winRate.el.className += " col-span-2 row-span-2";
  tournamentsStats.el.className += " col-span-2 row-span-2";
  latestMatch.el.className += " col-span-4 row-span-1";

  // Skeletons while fetching
  const sk = (hgt = "h-24") => h("div", { class: `animate-pulse bg-slate-200/60 rounded-xl ${hgt}` });
  root.replaceChildren(matchHistory.el, profileCard.el, winRate.el, tournamentsStats.el, latestMatch.el);
  matchHistory.update([]);
  winRate.update(null);
  tournamentsStats.update(null);
  latestMatch.update(null);
  profileCard.update({ pseudo: "Loading…", email: "", avatarUrl: DEFAULT_AVATAR, twofaEnabled: false, isMe: state.isMe });

  try {
    // Two API calls in parallel
    const [overview, stats] = await Promise.all([ProfileAPI.getOverview(userId), ProfileAPI.getStats(userId)]);
    state.overview = overview;
    state.stats = stats;

    // Fill UI
    profileCard.update({ ...overview.user, isMe: state.isMe });
    matchHistory.update(overview.matchHistory);
    latestMatch.update(overview.latestMatch);
    winRate.update(stats);
    tournamentsStats.update(stats);
  } catch (err: any) {
    // Rudimentary error slate
    const msg = err?.message ?? "Failed to load profile";
    profileCard.update({ pseudo: "Error", email: msg, avatarUrl: DEFAULT_AVATAR, isMe: state.isMe });
  }

  return () => {
    // nothing to unbind (no global stores!)
  };
}
