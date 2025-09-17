// src/views/ProfileView.ts
import { domElem as h, mount } from "../ui/DomElement";
import { createSplashScreen } from "../ui/SplashScreen";
import { ProfileEditForm, type ProfileEditInitial } from "./ProfileEditForm";
import * as http from "../api/http";

// --- Types  ---
type MatchResult = { me: number; opp: number };

type LatestMatch = {
  me: { name: string; avatar: string; score: number };
  opponent: { name: string; avatar: string; score: number };
} | null;

type Stats = { won: number; winrate: number; tournaments: { win: number; loss: number } };

export type MeUserRow = {
  id: number;
  email: string;
  pseudo: string;
  is_2fa_enabled: 0 | 1;
  avatar_url: string | null;
};

export type PublicUserRow = {
  id: number;
  email: string;
  pseudo: string;
  avatar_url: string | null;
};

type MyProfile = {
  id: number;
  email: string;
  pseudo: string;
  is2faEnabled: boolean;
  avatarUrl: string | null;
};

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
  created_at: string; // stored as TEXT (UTC)
};

export type UserStats = {
  user_id: number;
  wins: number;
  losses: number;
  games_played: number;
  win_ratio: number;
  total_score: number;
  best_score: number;
  updated_at: string;
};

// API calls
function toMatchResults(viewerId: number, rows: MatchRow[]): MatchResult[] {
  return (
    rows
      // only finished rows with both scores
      .filter((m) => m.status === "finished" && m.score_p1 != null && m.score_p2 != null)
      .map((m) => {
        const amP1 = m.p1_id === viewerId;
        const me = amP1 ? (m.score_p1 as number) : (m.score_p2 as number);
        const opp = amP1 ? (m.score_p2 as number) : (m.score_p1 as number);
        return { me: me, opp: opp };
      })
  );
}

function parseUtc(s: string) {
  // SQLite TEXT → treat as UTC for ordering
  return Date.parse(s.replace(" ", "T") + "Z");
}

function latestFinished(rows: MatchRow[]): MatchRow | null {
  // if your SQL already orders DESC by created_at, you can just scan from the start
  const sorted = [...rows].sort((a, b) => parseUtc(b.created_at) - parseUtc(a.created_at));
  return sorted.find((m) => m.status === "finished" && m.score_p1 != null && m.score_p2 != null) ?? null;
}

export function toLatestMatch(viewerId: number, rows: MatchRow[]): LatestMatch {
  const m = latestFinished(rows);
  if (!m) return null;

  const amP1 = m.p1_id === viewerId;

  const meName = amP1 ? m.p1_pseudo : m.p2_pseudo;
  const meAvatar = (amP1 ? m.p1_avatar_url : m.p2_avatar_url) ?? DEFAULT_AVATAR;
  const meScore = amP1 ? (m.score_p1 as number) : (m.score_p2 as number);

  const oppName = amP1 ? m.p2_pseudo : m.p1_pseudo;
  const oppAvatar = (amP1 ? m.p2_avatar_url : m.p1_avatar_url) ?? DEFAULT_AVATAR;
  const oppScore = amP1 ? (m.score_p2 as number) : (m.score_p1 as number);

  return {
    me: { name: meName, avatar: meAvatar, score: meScore },
    opponent: { name: oppName, avatar: oppAvatar, score: oppScore },
  };
}

export async function fetchMyProfile() {
  const resProfile = await http.getRequest<MeUserRow>("/users/me");
  const myProfileInfo: MyProfile = {
    id: resProfile.id,
    email: resProfile.email,
    pseudo: resProfile.pseudo,
    is2faEnabled: resProfile.is_2fa_enabled == 1 ? true : false,
    avatarUrl: resProfile.avatar_url,
  };
  return myProfileInfo;
}

async function updateMyProfile(payload: { pseudo?: string; email?: string }) {
  const resProfile = await http.putRequest<MeUserRow>("/users/me", payload);
  const myProfileInfo: MyProfile = {
    id: resProfile.id,
    email: resProfile.email,
    pseudo: resProfile.pseudo,
    is2faEnabled: resProfile.is_2fa_enabled == 1 ? true : false,
    avatarUrl: resProfile.avatar_url,
  };
  return myProfileInfo;
}

export async function FetchingData() {
  const myProfileInfo = await fetchMyProfile();

  const resMatches: { userId: number; matches: MatchRow[]; limit: number; offset: number } = await http.getRequest(`users/${myProfileInfo.id}/matches`);
  const myMatches = resMatches.matches;
  //   console.log(myMatches);

  const track: MatchResult[] = toMatchResults(myProfileInfo.id, myMatches);
  //   console.log(track);

  const latestMatch = toLatestMatch(myProfileInfo.id, myMatches);

  const stats: UserStats = await http.getRequest<UserStats>(`/users/${myProfileInfo.id}/stats`);
  console.log("Stats", stats);
  //   console.log(stats);

  return { myProfileInfo, myMatches, track, latestMatch, stats };
}

async function fetchPublicUserByPseudo(pseudo: string): Promise<PublicUserRow | null> {
  const res = await http.getRequest<{ users: PublicUserRow[]; limit: number; offset: number }>(`/users/search?q=${encodeURIComponent(pseudo)}`);
  const users = res.users;
  return users ? users[0] : null;
}

async function fetchPublicOverview(userId: number) {
  const user = await http.getRequest<PublicUserRow>(`/users/${userId}`);
  const resMatches: { userId: number; matches: MatchRow[]; limit: number; offset: number } = await http.getRequest(`/users/${userId}/matches`);
  const matches = resMatches.matches;

  const track: MatchResult[] = toMatchResults(userId, matches);
  const latestMatch = toLatestMatch(userId, matches);
  const stats = await http.getRequest<UserStats>(`/users/${userId}/stats`);

  const publicProfile: MyProfile = {
    id: userId,
    email: user.email,
    pseudo: user.pseudo,
    is2faEnabled: false,
    avatarUrl: user.avatar_url ?? DEFAULT_AVATAR,
  };

  return { profile: publicProfile, track, latestMatch, stats };
}

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
    items.slice(0, 7).forEach(({ me, opp }) => {
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
  function render(s: UserStats | null) {
    slot.replaceChildren();
    if (!s) {
      slot.append(h("div", { class: "text-slate-400", text: "—" }));
      return;
    }
    const wrap = h("div", { class: "flex flex-col text-center" });
    mount(wrap, h("div", { class: "font-extrabold text-2xl text-teal-600", text: `${s.wins} games won` }), h("div", { class: "text-xl text-slate-400", text: `(${Math.round(s.win_ratio * 100)}%)` }));
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

  function update(u: MyProfile & { isMe?: boolean }) {
    uname.textContent = u.pseudo ?? "Pseudo";
    emailValue.textContent = u.email ?? "email@example.com";
    avatar.src = u.avatarUrl ?? DEFAULT_AVATAR;

    const isMe = !!u.isMe;
    if (isMe) {
      set2fa(!!u.is2faEnabled);
      if (!editBtn.isConnected) body.append(editBtn);
      twofaBadge.parentElement!.classList.remove("hidden");
    } else {
      editBtn.remove();
      twofaBadge.parentElement!.classList.add("hidden");
    }
  }

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
        if (payload.deleteAvatar) await http.deleteRequest("/users/me/avatar");
        if (payload.avatarFile) {
          const fd = new FormData();
          fd.append("avatar", payload.avatarFile, payload.avatarFile.name);
          await http.putForm("/users/me/avatar", fd);
        }

        // Profile fields
        const fields: { pseudo?: string; email?: string } = {};
        if (payload.pseudo !== undefined) fields.pseudo = payload.pseudo;
        if (payload.email !== undefined) fields.email = payload.email;
        if (Object.keys(fields).length) {
          const user = await updateMyProfile(payload);
          // reflect new values
          uname.textContent = user.pseudo;
          emailValue.textContent = user.email;
          avatar.src = user.avatarUrl ?? DEFAULT_AVATAR;
        }

        update(await fetchMyProfile());
        splash.close();
        form.dispose();
      },
      onCancel() {
        splash.close();
        form.dispose();
      },
      async on2faToggle(next) {
        if (next === "enable") {
          const setup = await http.postRequest<{ otpauth: string; qrDataUrl: string }>("/auth/2fa/setup");
          return setup; // form will render QR + code box
        } else {
          await await http.deleteRequest("/auth/2fa");
          set2fa(false);
          return { disabled: true as const };
        }
      },
      async on2faVerify(code) {
        await http.postRequest<{ success: boolean }>("/auth/2fa/verify", { code });
        set2fa(true);
        return { success: true as const };
      },
    });

    splash.setContent(form.wrap);
    splash.open();
  }

  body.append(editBtn);

  mount(box, header, body);
  return { el: box, update };
}

/* ---------------- Main exported view ---------------- */
// Reusable for me or any user
export async function ProfileView(root: HTMLElement, params: { pseudo?: string } = {}) {
  const isPublic = !!params.pseudo;
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

  // Initial skeleton
  root.replaceChildren(matchHistory.el, profileCard.el, winRate.el, tournamentsStats.el, latestMatch.el);
  matchHistory.update([]);
  winRate.update(null);
  tournamentsStats.update(null);
  latestMatch.update(null);
  profileCard.update({ id: 0, pseudo: "Loading…", email: "", avatarUrl: DEFAULT_AVATAR, is2faEnabled: false, isMe: true });

  try {
    if (!isPublic) {
      // Me Mode
      const data = await FetchingData();
      profileCard.update({ ...data.myProfileInfo, isMe: true });
      matchHistory.update(data.track);
      latestMatch.update(data.latestMatch);
      winRate.update(data.stats);
    } else {
      // Public Mode
      const user = await fetchPublicUserByPseudo(params.pseudo!);
      if (!user) {
        profileCard.update({ id: 0, pseudo: "User not found", email: "", avatarUrl: DEFAULT_AVATAR, is2faEnabled: false, isMe: false });
        matchHistory.update([]);
        latestMatch.update(null);
        winRate.update(null as any);
        return () => {};
      }

      const { profile, track, latestMatch: lm, stats } = await fetchPublicOverview(user.id);
      profileCard.update({ ...profile, isMe: false });
      matchHistory.update(track);
      latestMatch.update(lm);
      winRate.update(stats);
    }
  } catch (err: any) {}

  return () => {
    // nothing to unbind (no global stores!)
  };
}
