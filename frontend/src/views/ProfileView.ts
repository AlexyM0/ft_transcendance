// src/views/ProfileView.ts
import { domElem, mount, bind } from "../ui/DomElement";
import { auth } from "../store/auth.store";
import { usersIndex, loadUser } from "../store/usersIndex.store";
import { userStats, loadUserStats } from "../store/usersStats.store";

import { createSplashScreen } from "../ui/SplashScreen";
import { ProfileEditForm, type ProfileEditInitial, type ProfileEditPayload } from "./ProfileEditForm";
import { saveMyProfile, deleteAvatar } from "../store/editProfile.store";

const TITLE_CLASSES = "text-teal-600 text-lg font-extrabold";
const SHARED_CLASSES = "rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition p-4 overflow-hidden";
const DEFAULT_AVATAR = "/user.png";

const CARD_CLASSES = "rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden";

function Card(title: string, opts?: { minH?: string; contentClass?: string }) {
  const { minH = "min-h-28", contentClass = "" } = opts ?? {};

  const box = domElem("section", { class: CARD_CLASSES + " flex flex-col" });

  // Title docked top-left
  const header = domElem("h2", { class: TITLE_CLASSES + " p-4 pb-2", text: title });

  // Centered content slot (this is the magic)
  // grid + place-items-center centers both axes; min-h gives it breathing room
  const slot = domElem("div", {
    class: `h-full grid place-items-center ${minH} p-4 ${contentClass}`,
  });

  mount(box, header, slot);
  return { box, slot };
}

const MatchHistoryCard = () => {
  const { box, slot } = Card("Match History", { minH: "min-h-24" });

  const scores: { me: number; opp: number }[] = [
    { me: 1, opp: 2 },
    { me: 4, opp: 2 },
    { me: 5, opp: 3 },
    { me: 5, opp: 2 },
    { me: 1, opp: 6 },
    { me: 7, opp: 2 },
    { me: 1, opp: 2 },
  ];

  if (scores.length === 0) {
    const emptyMatchSquare = domElem("div", {
      class: "text-slate-400 text-lg",
      text: "No match to display yet.",
    });
    slot.append(emptyMatchSquare);
  } else {
    const row = domElem("div", { class: "flex flex-wrap items-center justify-center gap-4" });
    const scoreSquare = ({ me, opp }: { me: number; opp: number }) => {
      const win = me > opp;
      const colors = win ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-600" : "bg-rose-200 border-rose-500/40 text-rose-600";

      const box = domElem("div", {
        class: `w-14 h-16 py-1 rounded-md border ${colors} flex flex-col items-center justify-around leading-none select-none font-bold`,
      });
      const topScore = domElem("div", { text: String(me) });
      const bottomScore = domElem("div", { text: String(opp) });
      mount(box, topScore, bottomScore);
      return box;
    };
    scores.forEach((s) => row.append(scoreSquare(s)));
    slot.append(row);
  }
  return box;
};

const WinrateCard = () => {
  const { box, slot } = Card("Winning Rate", { minH: "min-h-24" });

  const data = { won: 23, winrate: 0.53 };

  const wrap = domElem("div", { class: "flex flex-col text-center" });
  const gamesWon = domElem("div", { class: "font-extrabold text-2xl text-teal-600", text: `${data.won} games won` });
  const winRate = domElem("div", { class: "text-xl text-slate-400", text: `(${Math.round(data.winrate * 100)}%)` });

  mount(wrap, gamesWon, winRate);
  slot.append(wrap);
  return box;
};

const TournamentsStatsCard = () => {
  const { box, slot } = Card("Tournaments Stats", { minH: "min-h-24" });

  const data = { win: 4, loss: 3 };

  const wrap = domElem("div", {
    class: "flex flex-row justify-around items-center gap-12",
  });

  const winStreak = domElem("div", {
    class: "bg-emerald-600/20 border-emerald-500/40 text-emerald-600 w-10 h-14 py-1 rounded-md border font-bold flex justify-center items-center",
  });
  const wsText = domElem("div", { text: `${data.win}` });
  mount(winStreak, wsText);

  const loseStreak = domElem("div", {
    class: "bg-rose-200 border-rose-500/40 text-rose-600 w-10 h-14 py-1 rounded-md border font-bold flex justify-center items-center",
  });
  const lsText = domElem("div", { text: `${data.loss}` });
  mount(loseStreak, lsText);

  mount(wrap, winStreak, loseStreak);
  slot.append(wrap);
  return box;
};

const LeaderboardCard = () => {
  const { box, slot } = Card("LeaderBoard", { minH: "min-h-32" });

  const players: { name: string; score: number }[] = [
    { name: "Frank", score: 217 },
    { name: "Tom", score: 37 },
    { name: "Youri", score: 543 },
  ].sort((a, b) => b.score - a.score);

  if (players.length === 0) {
    const emptyLeaderBoard = domElem("div", {
      class: "text-slate-400 text-lg",
      text: "None has played yet.",
    });
    slot.append(emptyLeaderBoard);
  } else {
    const list = domElem("div", { class: "mx-auto w-full max-w-md flex flex-col gap-2" });

    players.forEach((p, i) => {
      const isFirst = i === 0;
      const isSecond = i === 1;

      const gold = "\u{1F947}";
      const silver = "\u{1F948}";
      const bronze = "\u{1F949}";

      const bgColor = isFirst ? "bg-amber-300/50" : isSecond ? "bg-slate-300/50" : "bg-amber-700/50";
      const bdColor = isFirst ? "border-amber-300" : isSecond ? "border-slate-300" : "border-amber-700";
      const textColor = isFirst ? "text-amber-500" : isSecond ? "text-slate-500" : "text-amber-800";
      const rankEmoji = isFirst ? gold : isSecond ? silver : bronze;
      const row = domElem("div", {
        class: `flex items-center justify-between h-18 px-3 rounded-xl border ${bgColor} ${bdColor} ${textColor}`,
      });
      const rank = domElem("div", { class: "text-center text-lg", text: rankEmoji });
      const name = domElem("div", { class: "truncate", text: p.name });
      const score = domElem("div", { class: "text-right font-semibold [font-variant-numeric:tabular-nums]", text: String(p.score) });
      mount(row, rank, name, score);
      list.appendChild(row);
    });
    slot.append(list);
  }
  return box;
};

const LatestMatchCard = () => {
  const { box, slot } = Card("Latest Match", { minH: "min-h-10" });

  const matchesPlayed = 1;

  if (matchesPlayed === 0) {
    const emptyLeaderBoard = domElem("div", {
      class: "text-slate-400 text-lg",
      text: "None has played yet.",
    });
    slot.appendChild(emptyLeaderBoard);
  } else {
    const wrap = domElem("div", { class: "mx-auto w-full max-w-md flex flex-col gap-2" });
    const latestMatch = {
      me: { name: "Player One", avatar: DEFAULT_AVATAR, score: 7 },
      opponent: { name: "Tom", avatar: DEFAULT_AVATAR, score: 3 },
    };
    const didWin = latestMatch.me.score > latestMatch.opponent.score;

    function row(player: { name: string; avatar: string; score: number }, badge?: HTMLElement) {
      const rowEl = domElem("div", { class: "flex justify-between items-center w-full" });

      const nameBox = domElem("div", { class: "flex items-center gap-5" });
      const avatar = domElem("img", {
        class: "w-8 h-8 rounded-full object-cover",
        attributes: {
          src: player.avatar,
          alt: player.name,
        },
      });
      const name = domElem("div", { class: "truncate text-teal-600 font-medium", text: player.name });
      mount(nameBox, avatar, name);

      const scoreBox = domElem("div", { class: "flex items-center gap-2" });
      const score = domElem("div", { class: "w-6 text-right font-semibold [font-variant-numeric:tabular-nums]", text: String(player.score) });
      scoreBox.append(score, badge ?? domElem("div", { class: "w-5 h-5" }));

      mount(rowEl, nameBox, scoreBox);
      return rowEl;
    }
    const badge = domElem("div", {
      class: "w-5 h-5 rounded text-xs flex items-center justify-center " + (didWin ? "bg-emerald-600/70 text-white" : "bg-rose-600/70 text-white"),
      text: didWin ? "W" : "L",
    });

    const meRow = row(latestMatch.me, badge);
    const oppRow = row(latestMatch.opponent);
    mount(wrap, meRow, oppRow);
    slot.append(wrap);
  }

  return box;
};

const ProfileCard = () => {
  const box = domElem("div", { class: "rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden flex flex-col" });

  // Top: gradient header (~1/3 height)
  const header = domElem("div", { class: "h-44 sm:h-60 bg-gradient-to-r from-teal-700 to-emerald-300 p-4 flex flex-col justify-center items-center gap-6" });
  const avatar = domElem("img", {
    class: "w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ring-white/70 object-cover",
    attributes: {
      src: DEFAULT_AVATAR,
      alt: "avatar",
    },
  });
  const uname = domElem("div", { class: "text-white font-semibold text-lg sm:text-xl", text: "Pseudo" });
  mount(header, avatar, uname);

  // Bottom: details + button pinned at bottom
  const body = domElem("div", { class: "p-6 flex-1 flex flex-col gap-4" });

  // Row: email
  const emailRow = domElem("div", { class: "flex items-center justify-between" });
  const emailLabel = domElem("span", { class: "text-lg text-zinc-400", text: "Email" });
  const emailValue = domElem("span", { class: "text-lg font-medium text-teal-600 truncate max-w-[60%] text-right", text: "Email" });
  mount(emailRow, emailLabel, emailValue);

  // Row: 2FA status
  const twofaRow = domElem("div", { class: "flex items-center justify-between" });
  const twofaLabel = domElem("span", {
    class: "text-lg text-zinc-400",
    text: "2FA",
  });

  const BADGE_BASE = "inline-flex items-center px-2 py-0.5 rounded-full text-lg border";
  const BADGE_ON = "border-emerald-500/50 text-emerald-500 bg-emerald-600/15";
  const BADGE_OFF = "border-rose-600 text-rose-600 bg-rose-200";

  const twofaBadge = domElem("span", {
    class: `${BADGE_BASE} ${BADGE_OFF}`,
    text: "Disabled",
  });

  mount(twofaRow, twofaLabel, twofaBadge);

  // Spacer so the button hugs the bottom
  const spacer = domElem("div", { class: "flex-1" });

  // Edit profile button
  const editBtn = domElem("button", { class: "text-gray-400 hover:text-teal-600 text-lg font-bold mouse-pointer", text: "Edit profile" });
  editBtn.append(domElem("i", { class: "ml-3 fa-solid fa-edit" }));

  const editProfileMenu = createSplashScreen("Edit Profile");
  document.body.appendChild(editProfileMenu.backdrop);

  editBtn.addEventListener("click", () => {
    const form = ProfileEditForm(() => editProfileMenu.close());
    editProfileMenu.setContent(form.wrap);
    editProfileMenu.open();
  });
  mount(body, emailRow, twofaRow, spacer, editBtn);
  mount(box, header, body);

  function setText(el: HTMLElement, value: string | undefined | null, fallback: string) {
    if (value === undefined) return; // do nothing if key not provided
    el.textContent = value ?? fallback; // null -> fallback, "" stays ""
  }

  function setSrc(img: HTMLImageElement, value: string | undefined | null, fallback: string) {
    if (value === undefined) return;
    img.src = value ?? fallback;
  }

  function set2fa(enabled: boolean | undefined) {
    if (enabled === undefined) return;
    twofaBadge.textContent = enabled ? "Enabled" : "Disabled";
    twofaBadge.classList.remove(...BADGE_ON.split(" "), ...BADGE_OFF.split(" "));
    twofaBadge.classList.add(...(enabled ? BADGE_ON : BADGE_OFF).split(" "));
  }

  function update(input: { pseudo?: string | null; email?: string | null; avatarUrl?: string | null; twofaEnabled?: boolean }) {
    setText(uname, input.pseudo, "Pseudo");
    setText(emailValue, input.email, "email@example.com");
    setSrc(avatar as HTMLImageElement, input.avatarUrl, "/user.png");
    set2fa(input.twofaEnabled);
  }

  return { box, update };
};

const ProfileEditScreen = (userId: number) => {
  const u = usersIndex.get().byId[userId] ?? { pseudo: "", avatar_url: null };
  const email = auth.get().email ?? "";

  const initialProfile: ProfileEditInitial = {
    pseudo: u.pseudo,
    email,
    avatarUrl: u.avatar_url,
  };

  const form = ProfileEditForm(
    { pseudo: u.pseudo, email, avatarUrl: u.avatar_url },
    {
      onSubmit: async (payload: ProfileEditPayload) => {
        // Orchestrate changes in one place
        if (payload.deleteAvatar) {
          await deleteAvatar();
        }
        // Build profile input for saveMyProfile (only if needed)
        const saveInput: { email?: string; pseudo?: string; avatarFile?: File | null } = {};
        if (payload.pseudo !== undefined) saveInput.pseudo = payload.pseudo;
        if (payload.email !== undefined) saveInput.email = payload.email;
        if (payload.avatarFile) saveInput.avatarFile = payload.avatarFile;

        if (Object.keys(saveInput).length > 0) {
          await saveMyProfile(saveInput);
        }

        modal.close();
        form.dispose();
      },
      onCancel: () => {
        modal.close();
        form.dispose();
      },
    }
  );
};

export const ProfileView = async (root: HTMLElement) => {
  const meId = auth.get().meId as number;

  console.log(auth.get());
  console.log(usersIndex.get().byId[meId]);
  loadUser(meId);
  loadUserStats(meId);

  const matchHistory = MatchHistoryCard();
  const winRate = WinrateCard();
  const tournamentsStats = TournamentsStatsCard();
  const leaderBoard = LeaderboardCard();
  const profileCard = ProfileCard();
  const latestMatch = LatestMatchCard();

  root.className = "grid grid-cols-8 grid-rows-5 gap-3 px-8 py-12";

  matchHistory.className += " col-span-4 row-span-1";
  profileCard.box.className += " col-span-4 row-span-4";
  winRate.className += " col-span-2 row-span-2";
  tournamentsStats.className += " col-span-2 row-span-2";
  leaderBoard.className += " col-span-4 row-span-2";
  latestMatch.className += " col-span-4 row-span-1";

  root.replaceChildren(matchHistory, profileCard.box, winRate, tournamentsStats, leaderBoard, latestMatch);

  const unbindAuth = bind(auth, (s) => {
    profileCard.update({ email: s.email as string, twofaEnabled: s.twofaEnabled });
  });

  const unbindUsersIndex = bind(usersIndex, (s) => {
    const u = s.byId[meId];
    profileCard.update({ pseudo: u.pseudo, avatarUrl: u.avatar_url as string });
  });

  return () => {
    unbindAuth;
    unbindUsersIndex;
  };
};
