// src/views/AppShell.ts
import { domElem, mount, bind } from "../ui/DomElement";
import { Button, IconButton, ImageButton } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icons";
import { auth, logout } from "../store/auth";

/**
 * A View mounts into a host and returns an unmount function
 */
export type View = (host: HTMLElement, params: Record<string, string>) => () => void;

/* ------------------ Small UI primitives ------------------ */

function currentPath() {
  return (location.hash || "#/home").replace(/^#/, "") || "/profile";
}

/** Map route path → human title. Adjust as you add pages. */
function pageTitleFromPath(path: string) {
  if (path.startsWith("/play")) return "Play";
  if (path.startsWith("/leaderboard")) return "Leaderboard";
  if (path.startsWith("/profile")) return "Profile";
  if (path.startsWith("/chats")) return "Chats";
  if (path.startsWith("/tournaments")) return "Tournaments";
  return "Transcendance";
}

/* ------------------ Nav link with icon ------------------ */

function NavLinkIcon(label: string, href: string, faClass: string) {
  const a = domElem("a", {
    class: "group flex items-center gap-3 text-gray-400 hover:text-teal-600",
    attributes: { href: `#${href}` },
  });

  const icon = domElem("i", { class: `w-5 h-5 fa-solid ${faClass}` });
  const text = domElem("span", { class: "text-lg font-semibold", text: label });
  a.append(icon, text);

  // initial active state
  const setActive = () => {
    const active = currentPath() === href;
    a.classList.toggle("text-teal-600", active);
    text.classList.toggle("font-semibold", active);
  };
  setActive();

  // reactive on hashchange
  const onHash = () => setActive();
  window.addEventListener("hashchange", onHash);

  // return element + unbind so sidebar can clean up listeners
  return { el: a, unbind: () => window.removeEventListener("hashchange", onHash) };
}

/* ------------------ User box (sidebar bottom) ------------------ */

const UserBox = () => {
  const box = domElem("div", { class: "mt-auto flex items-center gap-3 p-2 rounded-xl bg-gray-50" });
  const avatar = Avatar(null, 36);
  const name = domElem("div", { class: "text-sm" });
  box.append(avatar, name);
  return { box, avatar, name };
};

/**
 * Left sidebar with brand, nav, user and logout
 */
const SideBar = () => {
  const box = domElem("aside", { class: "w-64 bg-white border-r border-gray-100 p-4 flex flex-col gap-4" });

  const brandBox = domElem("div", { class: "flex flex-row items-center gap-3" });
  const brand = domElem("div", { class: "text-xl font-semibold text-teal-600", text: "Transcendance" });
  mount(brandBox, Icon("/ping-pong.png", "Transcendance logo"), brand);

  const nav = domElem("nav", { class: "flex flex-col gap-16 mt-40 ml-4 text-gray-400 text-xl" });
  const links = [
    NavLinkIcon("Play", "/play", "fa-gamepad"),
    NavLinkIcon("Leaderboard", "/home", "fa-house"),
    NavLinkIcon("Profile", "/profile", "fa-address-card"),
    NavLinkIcon("Chats", "/chats", "fa-comments"),
    NavLinkIcon("Tournaments", "/tournaments", "fa-trophy"),
  ];
  links.forEach((l) => nav.appendChild(l.el));

  const userBox = UserBox();
  const logoutBtn = Button("Logout", { variant: "danger", onClick: () => logout() });

  box.append(brandBox, nav, userBox.box, logoutBtn);

  // expose cleanup to remove hash listeners on links
  const unbind = () => links.forEach((l) => l.unbind());
  return { box, userBox, unbind };
};

/**
 * Top Bar
 */
const TopBar = () => {
  const wrap = domElem("div", { class: "sticky top-3 bg-transparent text-2xl font-bold text-emerald-700 z-10" });
  const row = domElem("div", { class: "h-14 px-8 flex items-center justify-between" });

  // Left: dynamic title
  const title = domElem("div");
  const icon = domElem("i", { class: "fa-solid fa-bars mr-4" });
  const text = domElem("span", { text: pageTitleFromPath(currentPath()) });
  mount(title, icon, text);

  // Right: actions
  const actions = domElem("div", { class: "flex items-center gap-5 justify-between" });
  const searchBtn = IconButton("fa-magnifying-glass", "search icon", () => (location.hash = "/friends"));

  // Language toggle (persisted locally)
  const lang = (localStorage.getItem("lang") || "en").toLowerCase();
  const langBtn = IconButton(
    "fa-language",
    "Toggle language",
    () => {
      const next = (localStorage.getItem("lang") || "en").toLowerCase() === "en" ? "fr" : "en";
      localStorage.setItem("lang", next);
      document.documentElement.lang = next;
    },
    "Toggle language"
  );

  // User avatar (click → profile)
  const avatarBtn = ImageButton(auth.get().me?.avatar_url ?? "/user.png", "Avatar", {
    onClick: () => (location.hash = "/profile"),
    size: 32,
    variant: "circle",
  });

  actions.append(searchBtn, langBtn, avatarBtn);
  row.append(title, actions);
  wrap.appendChild(row);

  // Keep the title reactive to route changes
  const onHash = () => {
    title.textContent = pageTitleFromPath(currentPath());
  };
  window.addEventListener("hashchange", onHash);

  // expose hooks to update avatar & cleanup
  return {
    wrap,
    avatarBtn,
    unbind() {
      window.removeEventListener("hashchange", onHash);
    },
  };
};

/**
 * Main area with an outlet where child views render
 */
const MainArea = () => {
  const box = domElem("main", { class: "flex-1 flex flex-col overflow-auto" });
  const topBar = TopBar();
  const outlet = domElem("div", { class: "px-8 py-8" });
  mount(box, topBar.wrap, outlet);
  return { box, outlet, topBar };
};

/**
 * Subscribe UI to auth store; returns an unbind function
 */
const bindAuth = (avatarEl: HTMLDivElement) => {
  return bind(auth, (s) => {
    const url = s.me?.avatar_url ?? "/user.png";

    let img = avatarEl.querySelector("img") as HTMLImageElement | null;
    if (url) {
      if (!img) {
        img = document.createElement("img");
        img.className = "w-full h-full object-cover";
        avatarEl.appendChild(img);
      }
      img.src = url;
    } else if (img) {
      img.remove();
    }
  });
};

/**
 * AppShell : mounts the application (sidebar + main) and the child view.
 * Returns an unmount function that disposes subscriptions and child view.
 */
export function AppShell(child: View) {
  return (root: HTMLElement, params: Record<string, string>) => {
    root.className = "min-h-screen bg-emerald-100 text-slate-800";

    const layout = domElem("div", { class: "h-screen flex" });
    const sideBar = SideBar();
    const mainArea = MainArea();

    mount(layout, sideBar.box, mainArea.box);
    root.appendChild(layout);

    // Mount : set up bindings and child view
    // const unbindAuth = bindAuth(mainArea.topBar.userAvatar);
    const unmountChild = child(mainArea.outlet, params);

    // Unmount : clean up in reverse order
    return () => {
      //   unbindAuth();
      unmountChild();
    };
  };
}
