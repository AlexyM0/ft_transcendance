// src/views/ProfileView.ts
import { domElem, mount, bind } from "../ui/DomElement";
import { auth } from "../store/auth";
import { updateMe, uploadAvatar, deleteAvatar } from "../store/users";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { LabeledInput } from "../ui/Input";
import { Avatar } from "../ui/Avatar";

const TITLE_CLASSES = "text-teal-600 text-lg font-extrabold";
const SHARED_CLASSES = "rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition p-4 overflow-hidden";
const DEFAULT_AVATAR = "/user.png";
const MatchHistoryCard = () => {
  const box = domElem("div", {
    class: SHARED_CLASSES,
  });
  const title = domElem("h2", {
    class: TITLE_CLASSES,
    text: "Match History",
  });

  const scoresContainer = domElem("div", {
    class: "flex flex-row justify-around gap-5 py-6 px-4",
  });

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

  const scores: { me: number; opp: number }[] = [
    { me: 1, opp: 2 },
    { me: 4, opp: 2 },
    { me: 5, opp: 3 },
    { me: 5, opp: 2 },
    { me: 1, opp: 6 },
    { me: 7, opp: 2 },
    { me: 1, opp: 2 },
  ];

  scores.forEach((s) => scoresContainer.append(scoreSquare(s)));

  mount(box, title, scoresContainer);
  return box;
};

const WinrateCard = () => {
  const box = domElem("div", { class: SHARED_CLASSES });
  const title = domElem("h2", { class: TITLE_CLASSES, text: "Winning Rate" });

  const data = { won: 23, winrate: 0.53 };

  const dataSquare = ({ won, winrate }: { won: number; winrate: number }) => {
    const box = domElem("div", { class: "h-full flex flex-col items-center justify-center" });
    const gamesWon = domElem("div", { class: "font-extrabold text-2xl text-teal-600", text: `${won} games won` });
    const winRate = domElem("div", { class: "text-xl text-slate-400", text: `\(${winrate * 100}%\)` });
    mount(box, gamesWon, winRate);
    return box;
  };

  mount(box, title, dataSquare(data));
  return box;
};

const LongestStreakCard = () => {
  const box = domElem("div", { class: SHARED_CLASSES });
  const title = domElem("h2", { class: TITLE_CLASSES, text: "Longest Streak" });

  const data = { win: 4, loss: 3 };

  const streakContainer = domElem("div", {
    class: "h-full flex flex-row justify-around items-center gap-5 py-6 px-4",
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

  mount(streakContainer, winStreak, loseStreak);
  mount(box, title, streakContainer);
  return box;
};

const LeaderboardCard = () => {
  const box = domElem("div", { class: SHARED_CLASSES });
  const title = domElem("h2", { class: TITLE_CLASSES, text: "LeaderBoard" });

  const players: { name: string; score: number }[] = [
    { name: "Frank", score: 217 },
    { name: "Tom", score: 37 },
    { name: "Youri", score: 543 },
  ];

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const list = domElem("div", { class: "mt-3 flex flex-col gap-3 justify-around py-4" });

  sorted.forEach((p, i) => {
    const isFirst = i === 0;
    const isSecond = i === 1;
    const isThird = i === 2;

    const gold = "\u{1F947}";
    const silver = "\u{1F948}";
    const bronze = "\u{1F949}";

    const bgColor = isFirst ? "bg-amber-300/50" : isSecond ? "bg-slate-300/50" : "bg-amber-700/50";
    const bdColor = isFirst ? "border-amber-300" : isSecond ? "border-slate-300" : "border-amber-700";
    const textColor = isFirst ? "text-amber-500" : isSecond ? "text-slate-500" : "text-amber-800";
    const rankEmoji = isFirst ? gold : isSecond ? silver : bronze;

    const row = domElem("div", {
      class: `flex items-center justify-between h-18 px-3 rounded-xl ${bgColor} border ${bdColor} ${textColor} font-extrabold`,
    });

    // Optional rank badge (keeps alignment consistent)
    const rank = domElem("div", {
      class: "w-8 shrink-0 text-center text-xl font-semibold mr-4",
      text: rankEmoji,
    });

    const name = domElem("div", {
      class: "flex-1 min-w-0 truncate",
      text: p.name,
    });

    const score = domElem("div", {
      // tabular-nums keeps digits aligned vertically
      class: "w-16 shrink-0 text-right font-semibold" + "[font-variant-numeric:tabular-nums]",
      text: String(p.score),
    });

    mount(row, rank, name, score);
    list.appendChild(row);
  });

  mount(box, title, list);
  return box;
};

const ProfileCard = () => {
  const user = {
    username: "PlayerOne",
    email: "player@example.com",
    avatar_url: "/user.png",
    twofa_enabled: true,
  };

  const box = domElem("div", { class: "rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden flex flex-col" });

  // Top: gradient header (~1/3 height)
  const header = domElem("div", {
    class: "h-44 sm:h-60 bg-gradient-to-r from-teal-700 to-emerald-300 p-4 flex flex-col justify-center items-center gap-6",
  });
  const avatar = domElem("img", {
    class: "w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ring-white/70 object-cover",
    attributes: {
      src: user.avatar_url || DEFAULT_AVATAR,
      alt: user.username,
    },
  });
  const uname = domElem("div", {
    class: "text-white font-semibold text-lg sm:text-xl",
    text: user.username,
  });
  mount(header, avatar, uname);

  // Bottom: details + button pinned at bottom
  const body = domElem("div", { class: "p-4 pt-3 flex-1 flex flex-col gap-3" });

  // Row: email
  const emailRow = domElem("div", {
    class: "flex items-center justify-between",
  });
  const emailLabel = domElem("span", {
    class: "text-sm text-zinc-400",
    text: "Email",
  });
  const emailValue = domElem("span", {
    class: "text-sm font-medium text-zinc-200 truncate max-w-[60%] text-right",
    text: user.email,
  });
  mount(emailRow, emailLabel, emailValue);

  // Row: 2FA status
  const twofaRow = domElem("div", {
    class: "flex items-center justify-between",
  });
  const twofaLabel = domElem("span", {
    class: "text-sm text-zinc-400",
    text: "2FA",
  });
  const twofaBadge = domElem("span", {
    class:
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs border " +
      (user.twofa_enabled ? "border-emerald-500/50 text-emerald-300 bg-emerald-600/15" : "border-zinc-600 text-zinc-300 bg-zinc-700/30"),
    text: user.twofa_enabled ? "Enabled" : "Disabled",
  });
  mount(twofaRow, twofaLabel, twofaBadge);

  // Spacer so the button hugs the bottom
  const spacer = domElem("div", { class: "flex-1" });

  // Edit profile button
  const editBtn = domElem("button", {
    class: "text-gray-400 hover:text-teal-600 text-lg font-bold mouse-pointer",
    text: "Edit profile",
  });
  editBtn.append(domElem("i", { class: "ml-3 fa-solid fa-edit" }));

  // Hook up an action later:
  editBtn.addEventListener("click", () => {
    // open modal / navigate
    // router.go("/profile/edit")
  });
  mount(body, emailRow, twofaRow, spacer, editBtn);

  mount(box, header, body);
  return box;
};

const LatestMatchCard = () => {
  const box = domElem("div", { class: SHARED_CLASSES });
  const title = domElem("h2", { class: TITLE_CLASSES, text: "Latest Match card" });
  mount(box, title);
  return box;
};

export const ProfileView = (root: HTMLElement) => {
  const matchHistory = MatchHistoryCard();
  const winRate = WinrateCard();
  const longestStreak = LongestStreakCard();
  const leaderBoard = LeaderboardCard();
  const profileCard = ProfileCard();
  const latestMatch = LatestMatchCard();

  root.className = "grid grid-cols-8 grid-rows-5 gap-3 px-8 py-12";

  matchHistory.className += " col-span-4 row-span-1";
  profileCard.className += " col-span-4 row-span-4";
  winRate.className += " col-span-2 row-span-2";
  longestStreak.className += " col-span-2 row-span-2";
  leaderBoard.className += " col-span-4 row-span-2";
  latestMatch.className += " col-span-4 row-span-1";

  root.replaceChildren(matchHistory, profileCard, winRate, longestStreak, leaderBoard, latestMatch);
};
//   const card = Card();
//   const avZone = domElem("div", { class: "flex items-center gap-4" });
//   const form = domElem("form", { class: "mt-4 flex items-end gap-3" });
//   const pseudo = LabeledInput("Pseudo");
//   const avatarUrl = LabeledInput("Avatar URL");
//   const save = Button("Save", { type: "submit" });
//   const del = Button("Remove avatar", { variant: "ghost", onClick: () => deleteAvatar() });
//   form.addEventListener("submit", async (e) => {
//     e.preventDefault();
//     const p = (pseudo.input as HTMLInputElement).value.trim();
//     const url = (avatarUrl.input as HTMLInputElement).value.trim();
//     if (p) await updateMe({ pseudo: p });
//     if (url) await uploadAvatar(url);
//   });
//   mount(card, avZone, form);
//   mount(form, pseudo.labelWrapper, avatarUrl.labelWrapper, save, del);
//   const unbind = bind(auth, (s) => {
//     avZone.replaceChildren(Avatar(s.me?.avatar_url ?? null, 64), domElem("div", { class: "font-medium", text: s.me?.pseudo ?? "..." }));
//     pseudo.input.value = s.me?.pseudo ?? "";
//     avatarUrl.input.value = s.me?.avatar_url ?? "";
//   });
//   root.append(card);
//   return () => unbind();
