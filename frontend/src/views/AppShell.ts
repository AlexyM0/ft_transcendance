// src/views/AppShell.ts
import { domElem, mount, bind } from "../ui/DomElement";
import { Button, IconButton, ImageButton } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icons";
import { auth, logout } from "../store/auth.store";
import { loadUser, usersIndex } from "../store/usersIndex.store";
import type { PublicUser } from "../api/types";
import { Chats } from "../helpers/chats.store";
import { acceptFriendRequest, declineFriendRequest, searchUsers, sendFriendRequest, unfriend, type SearchHit } from "../api/friends";

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

/**
 * Left sidebar with brand, nav, user and logout
 */
const SideBar = () => {
  const wrap = domElem("aside", { class: "h-full w-64 bg-white border-r border-gray-100 p-4 flex flex-col gap-4 justify-between" });

  const brandBox = domElem("div", { class: "flex flex-row items-center gap-3" });
  const brand = domElem("div", { class: "text-xl font-semibold text-teal-600", text: "Transcendance" });
  mount(brandBox, Icon("/ping-pong.png", "Transcendance logo"), brand);

  const nav = domElem("nav", { class: "flex flex-col gap-16 text-gray-400 text-xl pl-6 -mt-30" });
  const links = [
    NavLinkIcon("Play", "/play", "fa-gamepad"),
    NavLinkIcon("Profile", "/profile", "fa-address-card"),
    NavLinkIcon("Chats", "/chats", "fa-comments"),
    NavLinkIcon("Tournaments", "/tournaments", "fa-trophy"),
  ];
  links.forEach((l) => nav.appendChild(l.el));

  const logoutBtn = domElem("button", { class: "px-3 py-4 bg-emerald-700 rounded-md text-white font-semibold hover:bg-emerald-700/50", text: "Logout" });
  logoutBtn.addEventListener("click", () => logout());
  logoutBtn.append(domElem("i", { class: "ml-3 fa-solid fa-right-from-bracket" }));

  wrap.append(brandBox, nav, logoutBtn);

  // expose cleanup to remove hash listeners on links
  const unbind = () => links.forEach((l) => l.unbind());
  return { wrap, unbind };
};

/**
 * Top Bar
 */
function debounce<F extends (...a: any[]) => void>(fn: F, ms: number) {
  let t: number | null = null;
  return (...args: Parameters<F>) => {
    if (t) clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

function rowStatus(text: string) {
  return domElem("div", { class: "px-3 py-2 text-sm text-slate-500", text });
}

const TopBar = (me: PublicUser) => {
  const wrap = domElem("div", { class: "sticky top-3 bg-emerald-100 text-2xl font-bold text-emerald-700 z-10" });
  const row = domElem("div", { class: "h-14 px-8 flex items-center justify-between" });

  // Left: dynamic title
  const title = domElem("div");
  const icon = domElem("i", { class: "fa-solid fa-bars mr-4" });
  const text = domElem("span", { text: pageTitleFromPath(currentPath()) });
  mount(title, icon, text);

  // Right: actions
  const actions = domElem("div", { class: "flex items-center gap-5 justify-between" });

  // Search controls
  const searchHost = domElem("div", { class: "relative" });
  const searchBtn = IconButton("fa-magnifying-glass", "Search users", openSearch);

  const inputWrap = domElem("div", { class: "hidden md:w-80 w-64 relative z-10" });
  const input = domElem("input", {
    class: "w-full pl-3 pr-10 py-2 rounded-full border border-emerald-300 bg-white outline-none focus:ring-2 focus:ring-emerald-400 text-base",
    attributes: {
      type: "search",
      placeholder: "Search users...",
      role: "combobox",
      "aria-expanded": "false",
      "aria-autocomplete": "list",
    },
  }) as HTMLInputElement;

  const loupe = domElem("i", { class: "fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-emeral-600 pointer-events-none" });
  const loupeWrap = domElem("div", { class: "pointer-events-none" });
  loupeWrap.appendChild(loupe);

  const dropdown = domElem("div", {
    class: "absolute z-20 top-full left-0 mt-2 w-full rounded-xl border border-emerald-200 bg-white shadow-lg hidden",
    attributes: { role: "listbox" },
  });

  const inputPos = domElem("div", { class: "relative" });
  mount(inputPos, input, loupeWrap);
  mount(inputWrap, inputPos);
  mount(searchHost, searchBtn, inputWrap, dropdown);

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
  const avatarBtn = ImageButton(me.avatar_url || "/user.png", "Avatar", {
    onClick: () => (location.hash = "/profile"),
    size: 32,
    variant: "circle",
  });

  mount(actions, searchHost, langBtn, avatarBtn);
  mount(row, title, actions);
  wrap.appendChild(row);

  // Search behaviour
  let open = false;
  let inflight: AbortController | null = null;

  function setSearchBtnVisible(v: boolean) {
    const btn = (searchBtn.matches("button") ? searchBtn : searchBtn.querySelector("button")) as HTMLElement | null;
    const target = btn ?? searchBtn;
    target.style.display = v ? "" : "none";
  }

  function openSearch() {
    open = true;
    setSearchBtnVisible(false);
    inputWrap.classList.remove("hidden");
    input.value = "";
    setDropdownVisible(false);
    setTimeout(() => input.focus(), 0);
  }

  function closeSearch() {
    open = false;
    inputWrap.classList.add("hidden");
    setSearchBtnVisible(true);

    setDropdownVisible(false);
    if (inflight) {
      inflight.abort();
      inflight = null;
    }
  }

  function setDropdownVisible(v: boolean) {
    dropdown.classList.toggle("hidden", !v);
    input.setAttribute("aria-expanded", v ? "true" : "false");
  }

  const onDocClick = (e: MouseEvent) => {
    if (!open) return;
    if (!wrap.contains(e.target as Node)) closeSearch();
  };
  document.addEventListener("click", onDocClick);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSearch();
  });

  function renderResults(items: SearchHit[]) {
    dropdown.replaceChildren();
    if (!items.length) {
      dropdown.appendChild(rowStatus("No matches"));
      return;
    }

    items.forEach((u) => {
      const row = domElem("div", {
        class: "px-3 py-2 flex items-center gap-3 hover:bg-emerald-50 cursor-pointer",
        attributes: {
          role: "option",
        },
      });

      const avatar = domElem("img", {
        class: "w-8 h-8 rounded-full object-cover",
        attributes: {
          src: u.avatar_url || "/user.png",
          alt: `${u.pseudo}`,
        },
      });

      const name = domElem("div", { class: "flex-1 text-sm text-slate-800 truncate", text: u.pseudo });

      const actionBtn = (() => {
        if (u.relation === "friend") {
          const b = domElem("button", {
            class: "px-2 py-1 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500",
            attributes: { type: "button" },
            text: "Unfriend",
          });
          b.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            b.setAttribute("disabled", "true");
            try {
              await unfriend(u.id);
              u.relation = "none";
              b.replaceWith(makeAddBtn(u));
            } catch {
              b.removeAttribute("disabled");
            }
          });
          return b;
        }

        if (u.relation === "incoming_request") {
          const b = domElem("button", {
            class: "px-2 py-1 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500",
            attributes: { type: "button" },
            text: "Accept",
          });
          b.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            const rid = u.incoming_request_id!;
            b.setAttribute("disabled", "true");
            try {
              await acceptFriendRequest(rid);
              u.relation = "friend";
              delete u.incoming_request_id;
              b.replaceWith(makeUnfriendBtn(u));
            } catch {
              b.removeAttribute("disabled");
            }
          });
          return b;
        }

        if (u.relation === "outgoing_request") {
          const wrap = domElem("div", { class: "flex items-center gap-2" });
          const b = domElem("button", {
            class: "px-2 py-1 rounded-md text-xs font-semibold bg-slate-200 text-slate-700",
            attributes: { type: "button", disabled: "true", title: "Request sent" },
            text: "Requested",
          });
          const cancel = domElem("button", {
            class: "text-[11px] text-slate-500 hover:text-slate-700 underline",
            attributes: { type: "button", title: "Cancel request" },
            text: "Cancel",
          });
          cancel.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            const rid = u.outgoing_request_id!;
            cancel.setAttribute("disabled", "true");
            try {
              await declineFriendRequest(rid);
              u.relation = "none";
              delete u.outgoing_request_id;
              wrap.replaceChildren(makeAddBtn(u));
            } catch {
              cancel.removeAttribute("disabled");
            }
          });
          mount(wrap, b, cancel);
          return wrap;
        }

        return makeAddBtn(u);
      })();

      function makeAddBtn(user: SearchHit) {
        const b = domElem("button", {
          class: "px-2 py-1 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500",
          attributes: { type: "button" },
          text: "Add friend",
        });
        b.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          b.setAttribute("disabled", "true");
          try {
            const { id: requestId } = await sendFriendRequest(user.id);
            user.relation = "outgoing_request";
            user.outgoing_request_id = requestId;
            const requested = domElem("div", { class: "px-2 py-1 rounded-md text-xs font-semibold bg-slate-200 text-slate-700", text: "Requested" });
            b.replaceWith(requested);
          } catch {
            b.removeAttribute("disabled");
          }
        });
        return b;
      }

      function makeUnfriendBtn(user: SearchHit) {
        const b = domElem("button", {
          class: "px-2 py-1 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500",
          attributes: { type: "button" },
          text: "Unfriend",
        });
        b.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          b.setAttribute("disabled", "true");
          try {
            await unfriend(user.id);
            user.relation = "none";
            b.replaceWith(makeAddBtn(user));
          } catch {
            b.removeAttribute("disabled");
          }
        });
        return b;
      }

      mount(row, avatar, name, actionBtn);
      dropdown.appendChild(row);

      row.addEventListener("click", () => {
        location.hash = `#/profile`;
        closeSearch();
      });
    });
  }

  const runSearch = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) {
      setDropdownVisible(false);
      return;
    }

    if (inflight) {
      inflight.abort();
      inflight = null;
    }
    inflight = new AbortController();

    dropdown.replaceChildren(rowStatus("Searching..."));
    setDropdownVisible(true);

    try {
      const items = await searchUsers(q, 8);
      if (q !== input.value.trim()) return;
      renderResults(items);
    } catch {
      dropdown.replaceChildren(rowStatus("Failed to search"));
    } finally {
      inflight = null;
    }
  }, 220);

  input.addEventListener("input", () => runSearch());

  // Keep the title reactive to route changes
  const onHash = () => {
    title.textContent = pageTitleFromPath(currentPath());
  };
  window.addEventListener("hashchange", onHash);

  const avatarImage = avatarBtn.querySelector("img") as HTMLImageElement;
  const unbindAvatar = bindMeAvatar(avatarImage, me);
  // expose hooks to update avatar & cleanup
  return {
    wrap,
    avatarBtn,
    unbind() {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onDocClick);
      unbindAvatar();
    },
  };
};

/**
 * Main area with an outlet where child views render
 */
const MainArea = (me: PublicUser) => {
  const box = domElem("main", { class: "flex-1 flex flex-col overflow-auto" });
  const topBar = TopBar(me);
  const outlet = domElem("div", { class: "px-8 py-8 flex flex-col justify-between" });
  mount(box, topBar.wrap, outlet);
  return { box, outlet, topBar };
};

/**
 * Subscribe UI to auth store; returns an unbind function
 */
const bindMeAvatar = (avatarImage: HTMLImageElement, me: PublicUser) => {
  const update = () => {
    avatarImage.src = me?.avatar_url ?? "/user.png";
  };
  update();

  const stopAuth = bind(auth, update);
  const stopUsers = bind(usersIndex, update);
  return () => {
    stopAuth();
    stopUsers();
  };
};

/**
 * AppShell : mounts the application (sidebar + main) and the child view.
 * Returns an unmount function that disposes subscriptions and child view.
 */
export function AppShell(child: View) {
  return (root: HTMLElement, params: Record<string, string>) => {
    root.className = "min-h-screen bg-emerald-100 text-slate-800";

    const meId = auth.get().meId as number;
    const me = usersIndex.get().byId[meId];

    const layout = domElem("div", { class: "h-screen flex" });
    const sideBar = SideBar();
    const mainArea = MainArea(me);

    Chats.init();

    mount(layout, sideBar.wrap, mainArea.box);
    root.appendChild(layout);

    // Mount : set up bindings and child view
    const unmountChild = child(mainArea.outlet, params);

    // Unmount : clean up in reverse order
    return () => {
      unmountChild();
    };
  };
}
