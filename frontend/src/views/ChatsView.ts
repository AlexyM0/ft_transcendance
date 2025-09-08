// src/views/ChatView.ts

import { domElem as h, mount } from "../ui/DomElement";
import { Avatar } from "../ui/Avatar";
import { setPlayPreset } from "./PlayView";
import { Chats, subscribe } from "../helpers/chats.store";
import { auth } from "./../store/auth.store";
import * as apiFriends from "../api/friends";

/* ---------------- Types ---------------- */
type Friend = { id: number; name: string; avatar: string | null; online: boolean; last?: string };
type Msg = { id: number; author_id: number; body: string; at: string };
type ReqUser = { id: number; name: string; avatar: string | null; requestId: number };

const data = {
  friends: [] as Friend[],
  requests: {
    received: [] as ReqUser[],
    sent: [] as ReqUser[],
    blocked: [] as ReqUser[],
  },
};

const me = { id: auth.get().meId, name: "You", avatar: "/user.png" };

/* ---------------- Small helpers ---------------- */
function statusDot(online: boolean) {
  const c = online ? "bg-emerald-500" : "bg-slate-400";
  return h("span", { class: `inline-block w-2.5 h-2.5 rounded-full ${c}` });
}

function rightChevron(open: boolean) {
  return h("i", {
    class: "fa-solid fa-angle-right text-slate-500 transition-transform " + (open ? "rotate-90" : ""),
  });
}

function removeById<T extends { id: number }>(arr: T[], id: number) {
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1);
}

/* ---------------- Collapsible ---------------- */
function Collapsible(title: string, startOpen = true) {
  let open = startOpen;
  const wrap = h("div", { class: "rounded-xl border border-emerald-100 bg-white/50 overflow-hidden" });
  const head = h("button", {
    class: "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-emerald-100/50 transition border-b border-emerald-100",
    attributes: { type: "button" },
  });
  const icon = rightChevron(open);
  const label = h("div", { class: "font-semibold text-emerald-900", text: title });
  const body = h("div", { class: open ? "" : "hidden" });

  mount(head, icon, label);
  head.addEventListener("click", () => {
    open = !open;
    icon.classList.toggle("rotate-90", open);
    body.classList.toggle("hidden", !open);
  });

  mount(wrap, head, body);
  return { el: wrap, body };
}

/* ---------------- Left panel: Friends List (Messages tab) ---------------- */
function FriendsListPane(state: { activeId: number | null; friendQuery: string; setActive: (id: number) => void; setFriendQuery: (q: string) => void }) {
  const box = h("div", { class: "flex flex-col gap-3" });

  const search = h("input", {
    class: "mx-2 mt-1 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-100/70 " + "placeholder-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
    attributes: { placeholder: "Search friends…", type: "search" },
  }) as HTMLInputElement;
  search.value = state.friendQuery;
  search.addEventListener("input", () => state.setFriendQuery(search.value));

  const list = h("div", { class: "flex-1 overflow-y-auto pr-1 space-y-1" });

  function friendRow(f: Friend, active: boolean) {
    const row = h("button", {
      class: "w-full text-left px-3 py-2 rounded-xl transition grid grid-cols-[40px_1fr_auto] gap-3 " + (active ? "bg-emerald-200/50" : "hover:bg-emerald-100/60"),
      attributes: { type: "button" },
    });
    const avatar = Avatar(f.avatar, 40);
    const name = h("div", { class: "font-medium text-emerald-900 truncate", text: f.name });
    const preview = h("div", {
      class: "text-sm text-emerald-700/80 truncate max-w-[220px]",
      text: f.last?.trim() ? f.last! : "Say hi to…",
    });

    const onlineNow = Chats.getOnline(f.id);
    const meta = h("div", { class: "flex items-center gap-2" });
    mount(meta, statusDot(onlineNow), h("span", { class: "text-xs text-emerald-800/70", text: onlineNow ? "online" : "offline" }));
    const right = h("div", {});
    mount(right, name, preview, meta);

    const chatId = Chats.getChatIdByPeer(f.id);
    const unread = chatId ? Chats.getUnread(chatId) : 0;
    const unreadDot = unread > 0 ? h("span", { class: "ml-2 inline-block w-2 h-2 rounded-full bg-rose-600 self-center" }) : h("span");

    mount(row, avatar, right, unreadDot);
    row.addEventListener("click", () => state.setActive(f.id));
    return row;
  }

  function render() {
    list.replaceChildren();

    const order = new Map<number, number>(); // userId -> rank
    Chats.getSortedList().forEach((c, i) => {
      if (c.peer) order.set(c.peer.id, i);
    });

    const q = state.friendQuery.trim().toLowerCase();
    let friendsArr = q ? data.friends.filter((f) => f.name.toLowerCase().includes(q)) : [...data.friends];
    friendsArr.sort((a, b) => {
      const ra = order.has(a.id) ? order.get(a.id)! : Number.POSITIVE_INFINITY;
      const rb = order.has(b.id) ? order.get(b.id)! : Number.POSITIVE_INFINITY;
      return ra - rb;
    });
    if (friendsArr.length === 0) {
      list.appendChild(h("div", { class: "text-emerald-900/60 px-2 py-2", text: "No friends match your search." }));
    } else {
      friendsArr.forEach((f) => list.appendChild(friendRow(f, state.activeId === f.id)));
    }
  }

  mount(box, search, list);
  return { el: box, render };
}

/* ---------------- Left panel: Friend Requests tab ---------------- */
function RequestsPane(state: {
  requestQuery: string;
  setRequestQuery: (q: string) => void;
  onDataChanged: () => void; // call to re-render left panel when lists change
}) {
  const box = h("div", { class: "flex flex-col gap-3" });

  // Search (filters all three sections)
  const search = h("input", {
    class: "mx-2 mt-1 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-100/70 " + "placeholder-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
    attributes: { placeholder: "Search requests (sent / received / blocked)…", type: "search" },
  }) as HTMLInputElement;
  search.value = state.requestQuery;
  search.addEventListener("input", () => state.setRequestQuery(search.value));

  const sectionsWrap = h("div", { class: "flex-1 overflow-y-auto pr-1 space-y-2" });

  function requestRow(u: ReqUser, kind: "sent" | "received" | "blocked") {
    const row = h("div", {
      class: "w-full px-3 py-2 rounded-xl transition grid grid-cols-[40px_1fr_auto] gap-3 items-center hover:bg-emerald-100/50",
    });

    const name = h("div", { class: "font-medium text-emerald-900 truncate", text: u.name });

    // Icon-only actions
    const actions = h("div", { class: "flex items-center gap-2" });

    const iconBtn = (title: string, cls: string, onClick: () => void) => {
      const b = h("button", {
        class: "w-8 h-8 rounded-full grid place-items-center text-white transition " + cls,
        attributes: { type: "button", title, "aria-label": title },
      });
      b.addEventListener("click", onClick);
      return b;
    };

    if (kind === "received") {
      // Accept ✅ / Decline ❌
      const accept = iconBtn("Accept", "bg-emerald-600 hover:bg-emerald-500", async () => {
        try {
          await apiFriends.acceptFriendRequest(u.requestId);
          data.friends.unshift({ id: u.id, name: u.name, avatar: u.avatar, online: false, last: "" });
          removeById(data.requests.received, u.id);
          state.onDataChanged();
        } catch {}
      });
      accept.append(h("i", { class: "fa-solid fa-check text-sm" }));

      const decline = iconBtn("Decline", "bg-rose-600 hover:bg-rose-500", async () => {
        try {
          await apiFriends.declineFriendRequest(u.requestId);
          removeById(data.requests.received, u.id);
          state.onDataChanged();
        } catch {}
      });
      decline.append(h("i", { class: "fa-solid fa-xmark text-sm" }));
      actions.append(accept, decline);
    } else if (kind === "sent") {
      // Cancel (grey circle with 'x')
      const cancel = iconBtn("Cancel request", "bg-slate-300 text-slate-800 hover:bg-slate-400", async () => {
        try {
          await apiFriends.declineFriendRequest(u.requestId);
          removeById(data.requests.sent, u.id);
          state.onDataChanged();
        } catch {}
      });
      cancel.append(h("i", { class: "fa-solid fa-xmark text-sm" }));
      actions.append(cancel);
    } else {
      // Implement blocked users later
      // Unblock (amber circle with 'ban' slash)
      //   const unblock = iconBtn("Unblock", "bg-amber-500 hover:bg-amber-400", () => {
      //     removeById(friendReq.blocked, u.id);
      //     state.onDataChanged();
      //   });
      //   unblock.append(h("i", { class: "fa-solid fa-ban text-sm" }));
      //   actions.append(unblock);
    }

    mount(row, Avatar(u.avatar || "/user.png", 40), name, actions);
    return row;
  }

  function section(title: string, users: ReqUser[], kind: "sent" | "received" | "blocked") {
    const { el, body } = Collapsible(`${title} (${users.length})`, true);
    const list = h("div", { class: "py-1" });

    function renderRows() {
      list.replaceChildren();
      const q = search.value.trim().toLowerCase();
      const filtered = q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users;

      if (filtered.length === 0) {
        list.appendChild(h("div", { class: "text-emerald-900/60 px-3 py-2", text: q ? "No matches." : "Nothing here yet." }));
      } else {
        filtered.forEach((u) => list.appendChild(requestRow(u, kind)));
      }
    }

    renderRows();
    mount(body, list);
    return { el, renderRows };
  }

  const secRecv = section("Received", data.requests.received, "received");
  const secSent = section("Sent", data.requests.sent, "sent");
  const secBlocked = section("Blocked", [], "blocked");

  function render() {
    // update counts and rows
    sectionsWrap.replaceChildren();
    mount(sectionsWrap, secRecv.el, secSent.el, secBlocked.el); // show Received first for ergonomics
    secRecv.renderRows();
    secSent.renderRows();
    secBlocked.renderRows();
  }

  mount(box, search, sectionsWrap);
  render();

  return { el: box, render, search };
}

/* ---------------- Center panel ---------------- */
function TopBarCenter(friend: Friend | null) {
  const bar = h("div", { class: "h-14 px-4 border-b border-slate-100 flex items-center justify-between" });
  const left = h("div", { class: "flex items-center gap-3" });
  if (friend) {
    left.append(Avatar(friend.avatar, 32));
    left.append(h("div", { class: "font-semibold text-slate-800", text: friend.name }));

    const onlineNow = Chats.getOnline(friend.id);
    left.append(statusDot(onlineNow));

    const hint = h("div", { class: "text-xs text-slate-500 ml-3" });
    const chatId = Chats.getState().activeChatId;
    if (chatId) {
      const typing = Chats.getTypingUsers(chatId).filter((u) => u !== auth.get().meId);
      if (typing.length) hint.textContent = "typing...";
    }
    left.append(hint);
  } else {
    left.append(h("div", { class: "text-slate-400", text: "Select a friend" }));
  }
  const search = h("input", {
    class: "ml-auto px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500",
    attributes: { placeholder: "Search…", type: "search" },
  });
  bar.append(left, search);
  return bar;
}

/* ---------------- Messages subviews ---------------- */
function MessageBubble(m: Msg, isMine: boolean) {
  const wrap = h("div", { class: "flex " + (isMine ? "justify-end" : "justify-start") });
  const bubble = h("div", {
    class: "max-w-[70%] px-3 py-2 rounded-2xl shadow-sm " + (isMine ? "bg-emerald-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"),
  });
  bubble.append(h("div", { class: "whitespace-pre-wrap break-words", text: m.body }));
  bubble.append(h("div", { class: "text-[10px] opacity-70 mt-1 text-right", text: m.at }));
  wrap.append(bubble);
  return wrap;
}

function MessageList(centerWrap: HTMLElement, friendId: number | null) {
  const scroll = h("div", { class: "flex-1 overflow-y-scroll p-4 space-y-2" });

  function render() {
    scroll.replaceChildren();
    if (!friendId) {
      scroll.appendChild(h("div", { class: "text-slate-400 text-center mt-20", text: "Pick a friend on the left to start chatting." }));
      return;
    }

    const chatId = Chats.getState().activeChatId;
    if (!chatId) {
      scroll.appendChild(h("div", { class: "text-slate-400 text-center mt-20", text: "Loading..." }));
      return;
    }

    const msgs = Chats.getMessages(chatId);
    if (msgs.length === 0) {
      scroll.appendChild(h("div", { class: "text-slate-400 text-center mt-20", text: "No messages yet. Say hi 👋" }));
      return;
    }
    msgs.forEach((m) => scroll.appendChild(MessageBubble({ id: m.id, author_id: m.author_id, body: m.body, at: m.created_at?.slice(11, 16) ?? "" }, m.author_id === auth.get().meId)));
    setTimeout(() => (scroll.scrollTop = scroll.scrollHeight), 0);
  }

  centerWrap.appendChild(scroll);
  return { render, scroll };
}

function Composer(onSend: (text: string) => void) {
  const bar = h("form", { class: "h-14 px-3 border-t border-slate-100 flex items-center gap-2" });
  const input = h("input", {
    class: "flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500",
    attributes: { placeholder: "Type a message…", "aria-label": "Message", autocomplete: "off" },
  }) as HTMLInputElement;

  let typingTimer: number | null = null;
  input.addEventListener("input", () => {
    const chatId = Chats.getState().activeChatId;
    if (!chatId) return;
    Chats.setTyping(chatId, true);
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = window.setTimeout(() => Chats.setTyping(chatId, false), 1500);
  });

  const send = h("button", {
    class: "w-10 h-10 grid place-items-center rounded-xl bg-emerald-600 text-white hover:bg-indigo-500 transition",
    attributes: { type: "submit", title: "Send", "aria-label": "Send" },
  });
  send.append(h("i", { class: "fa-solid fa-paper-plane" }));

  bar.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    onSend(text);
    input.value = "";
    const chatId = Chats.getState().activeChatId;
    if (chatId) Chats.setTyping(chatId, false);
  });

  bar.append(input, send);
  return bar;
}

function CenterPanel(state: { activeId: number | null }) {
  const box = h("section", { class: "bg-white flex flex-col min-h-0" });

  const friend = () => data.friends.find((f) => f.id === state.activeId) ?? null;
  let top = TopBarCenter(friend());
  const messageArea = h("div", { class: "flex-1 flex flex-col min-h-0" });
  let list = MessageList(messageArea, state.activeId);
  const composer = Composer(async (text) => {
    if (!state.activeId) return;
    const chatId = Chats.getState().activeChatId;
    if (!chatId) return;
    await Chats.send(chatId, text);
    list.render(); // the WS "message" event will also re-render via store subscribe
  });

  mount(box, top, messageArea, composer);
  if (state.activeId) composer.classList.remove("hidden");
  else composer.classList.add("hidden");

  function render() {
    const freshTop = TopBarCenter(friend());
    box.replaceChild(freshTop, top);
    top = freshTop;

    messageArea.replaceChildren();
    list = MessageList(messageArea, state.activeId);
    list.render();

    if (state.activeId) composer.classList.remove("hidden");
    else composer.classList.add("hidden");
  }

  return { el: box, render };
}

/* ---------------- Right panel ---------------- */
// Replace the existing RightPanel with this one
function RightPanel(state: { activeId: number | null; forceRenderAll: () => void }) {
  const box = h("aside", { class: "bg-emerald-50 border-l border-emerald-100 p-4 flex flex-col" });

  // Small helper: block current active friend
  function blockActive() {
    const f = data.friends.find((x) => x.id === state.activeId);
    if (!f) return;

    // Remove from friends
    removeById(data.friends as Array<{ id: number }>, f.id);

    // Add to blocked if not already there
    // if (!friendReq.blocked.some((u) => u.id === f.id)) {
    //   friendReq.blocked.push({ id: f.id, name: f.name, avatar: f.avatar });
    // }

    // Clear selection and refresh UI
    state.activeId = null;
    state.forceRenderAll();
  }

  // Small helper: unfriend current active friend
  async function unfriendActive() {
    const f = data.friends.find((x) => x.id === state.activeId);
    if (!f) return;

    try {
      // Remove from friends
      await apiFriends.unfriend(f.id);
      removeById(data.friends as Array<{ id: number }>, f.id);

      // Clear selection and refresh UI
      state.activeId = null;
      state.forceRenderAll();
    } catch {}
  }

  function action(label: string, icon: string, tone: "green" | "red", onClick: () => void) {
    const base = "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition";
    const green = "text-emerald-700 hover:bg-emerald-100/60";
    const red = "text-rose-700 hover:bg-rose-100/60";
    const btn = h("button", {
      class: `${base} ${tone === "green" ? green : red}`,
      attributes: { type: "button" },
    });
    btn.append(h("i", { class: `fa-solid ${icon}` }), h("span", { class: "font-medium", text: label }));
    btn.addEventListener("click", onClick);
    return btn;
  }

  const actionsCol = h("div", { class: "mt-auto flex flex-col gap-2" });
  actionsCol.append(
    action("Invite to match", "fa-table-tennis-paddle-ball", "green", () => {
      const f = data.friends.find((x) => x.id === state.activeId);
      if (!f) return;

      // Map Chat friend -> Play User
      const opp = { id: f.id, alias: f.name, avatar: f.avatar };
      const meUser = { id: 1, alias: me.name, avatar: me.avatar }; // reuse your chat `me`

      setPlayPreset({ kind: "duel", me: { id: meUser.id, pseudo: meUser.alias, avatar_url: meUser.avatar }, opponent: { id: opp.id, pseudo: opp.alias, avatar_url: opp.avatar } });

      // Navigate to your Play route (adapt one of the lines below to your router)
      // router.go("play");
      // AppShell.show(PlayView);
      window.location.hash = "#/play"; // simplest default if you use hash routing
    }),

    action("Show profile", "fa-id-card", "green", () => {
      const f = data.friends.find((x) => x.id === state.activeId);
      if (f) window.location.hash = `#/users/${encodeURIComponent(f.name)}`;
    }),

    action("Unfriend", "fa-user-minus", "red", unfriendActive),
    action("Block user", "fa-ban", "red", blockActive)
  );

  function render() {
    box.replaceChildren();
    const f = data.friends.find((x) => x.id === state.activeId) ?? null;
    const header = h("div", { class: "flex items-center gap-3" });
    const spacer = h("div", { class: "mt-2" });

    if (f) {
      header.append(Avatar(f.avatar, 40));
      header.append(h("div", { class: "font-semibold text-emerald-900", text: f.name }));
      box.append(header, spacer, actionsCol);
    } else {
      header.append(h("div", { class: "text-emerald-900/60", text: "No friend selected" }));
      box.append(header);
    }
  }

  render();
  return { el: box, render };
}

/* ---------------- Left panel wrapper w/ Tabs ---------------- */
function LeftPanel(state: {
  activeId: number | null;
  leftTab: "messages" | "requests";
  friendQuery: string;
  requestQuery: string;
  setActive: (id: number) => void;
  setLeftTab: (t: "messages" | "requests") => void;
  setFriendQuery: (q: string) => void;
  setRequestQuery: (q: string) => void;
  forceRenderAll: () => void;
}) {
  const box = h("aside", { class: "bg-emerald-50 border-r border-emerald-100 p-3 flex flex-col gap-3" });

  // Tabs
  function tabButton(label: string, active: boolean, onClick: () => void) {
    const base = "px-1.5 py-1 text-sm transition font-semibold " + (active ? "text-emerald-900 underline underline-offset-4 decoration-2" : "text-emerald-700 hover:underline underline-offset-4");
    const btn = h("button", { class: base, attributes: { type: "button" }, text: label });
    btn.addEventListener("click", onClick);
    return btn;
  }
  const tabs = h("div", { class: "px-2 pt-1 flex gap-2" });
  const content = h("div", { class: "flex-1 min-h-0" });

  function renderTabs() {
    tabs.replaceChildren();

    const msgBtn = tabButton("Messages", state.leftTab === "messages", () => {
      state.setLeftTab("messages");
      render();
    });

    // Friend Requests with reddish pending counter docked on the right
    const reqBtn = tabButton("Friend Requests", state.leftTab === "requests", () => {
      state.setLeftTab("requests");
      render();
    });

    const pending = data.requests.received.length;
    if (pending > 0) {
      const badge = h("span", {
        class: "ml-2 inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded-full text-[10px] " + "bg-rose-600 text-white",
        text: String(pending),
      });
      reqBtn.appendChild(badge);
    }

    mount(tabs, msgBtn, reqBtn);
  }

  function render() {
    renderTabs();
    content.replaceChildren();
    if (state.leftTab === "messages") {
      const friendsPane = FriendsListPane({
        activeId: state.activeId,
        friendQuery: state.friendQuery,
        setActive: (id) => {
          state.setActive(id);
          render();
        },
        setFriendQuery: (q) => {
          state.setFriendQuery(q);
          friendsPane.render();
        },
      });
      mount(content, friendsPane.el);
      friendsPane.render();
    } else {
      const requestsPane = RequestsPane({
        requestQuery: state.requestQuery,
        setRequestQuery: (q) => {
          state.setRequestQuery(q);
        },
        onDataChanged: () => {
          render();
          state.forceRenderAll();
        },
      });

      // Header line for clarity
      const header = h("div", { class: "px-2 pt-1 text-emerald-900 font-semibold flex items-center" });
      mount(header, h("span", { text: "Friend Requests" }));
      mount(content, header, requestsPane.el);
      requestsPane.render();
    }
  }

  mount(box, tabs, content);
  render();

  return { el: box, render };
}

/* ---------------- Main view ---------------- */
export function ChatsView(root: HTMLElement) {
  const wrap = h("div", {
    class: "h-[calc(80vh-2rem)] m-4 rounded-2xl overflow-hidden " + "grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)_280px] border border-emerald-100 shadow bg-white",
  });

  // local UI state
  const state = {
    activeId: null as number | null,
    leftTab: "messages" as "messages" | "requests",
    friendQuery: "",
    requestQuery: "",
    setActive(id: number) {
      (async () => {
        const chatId = await Chats.ensureChatWith(id);
        await Chats.loadMessages(chatId);
        Chats.setActiveChat(chatId);

        this.activeId = id;
        left.render();
        center.render();
        right.render();
      })().catch(console.error);
    },
    setLeftTab(t: "messages" | "requests") {
      this.leftTab = t;
      left.render();
    },
    setFriendQuery(q: string) {
      this.friendQuery = q;
      left.render();
    },
    setRequestQuery(q: string) {
      this.requestQuery = q;
      left.render();
    },
    forceRenderAll() {
      // called when requests mutate (accept/decline/etc.)
      left.render();
      center.render();
      right.render();
    },
  };

  const left = LeftPanel(state);
  const center = CenterPanel(state);
  const right = RightPanel(state);

  mount(wrap, left.el, center.el, right.el);
  root.replaceChildren(wrap);

  const unsubscribe = subscribe(async () => {
    const s = Chats.getState();

    // Update left-panel message previews from store list
    for (const c of s.list) {
      const body = c.last_message?.body ?? null;
      if (!body || !c.peer) continue;

      const f = data.friends.find((x) => x.id === c.peer.id);
      if (f) f.last = body;
    }

    /**
     *  Friend-request live badge: if store counter increased, fetch the last request's sender
     *	We can check  'getFriendRequestsCount()' vs our local length
     */
    const count = Chats.getFriendRequestsCount();
    if (count > data.requests.received.length) {
      try {
        const rec = await apiFriends.getRequestsReceived();
        // merge only new ones
        const existing = new Set(data.requests.received.map((r) => r.requestId));
        const newOnes = rec.filter((r) => !existing.has(r.id));
        const add = await Promise.all(
          newOnes.map(async (r) => {
            const sender = await apiFriends.getPublicUser(r.from_user_id);
            return { id: sender.id, name: sender.pseudo, avatar: sender.avatar_url, requestId: r.id };
          })
        );
        data.requests.received.unshift(...add);
      } catch {}
    }
    left.render();
    center.render();
    right.render();
  });

  (async () => {
    const friendRows = await apiFriends.getFriends();
    data.friends = friendRows.map((u) => ({
      id: u.id,
      name: u.pseudo,
      avatar: u.avatar_url ?? "/user.png",
      online: false,
      last: "",
    }));

    // Request RECEIVED -> show sender profiles
    const rec = await apiFriends.getRequestsReceived();
    data.requests.received = await Promise.all(
      rec.map(async (r) => {
        const sender = await apiFriends.getPublicUser(r.from_user_id);
        return { id: sender.id, name: sender.pseudo, avatar: sender.avatar_url, requestId: r.id };
      })
    );

    // Requests SENT -> show recipient profiles
    const sent = await apiFriends.getRequestsSent();
    data.requests.sent = await Promise.all(
      sent.map(async (r) => {
        const to = await apiFriends.getPublicUser(r.to_user_id);
        return { id: to.id, name: to.pseudo, avatar: to.avatar_url, requestId: r.id };
      })
    );

    left.render();
  })().catch(console.error);

  return () => {
    unsubscribe();
    Chats.setActiveChat(null);
  };
}
