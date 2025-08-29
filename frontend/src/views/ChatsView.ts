// src/views/ChatsViews.ts
import { domElem, mount, bind } from "../ui/DomElement";
import * as Chats from "../store/chats";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { auth } from "../store/auth";

const renderChatList = (chatList: HTMLDivElement, s: Chats.ChatsState) => {
  chatList.replaceChildren();
  const ul = domElem("ul", { class: "divide-y divide-gray-100" });
  s.list.forEach((c) => {
    const li = domElem("li", { class: "p-3 hover:bg-indigo-50 cursor-pointer" });
    const last = c.last_message ? `- ${c.last_message.body.slice(0, 30)}` : "";
    li.textContent = `${c.peer.pseudo}${last}`;
    li.addEventListener("click", () => {
      location.hash = `/chats/${c.id}`;
    });
    ul.appendChild(li);
  });
  chatList.appendChild(ul);
};

const loadPreviousMessages = (conversation: HTMLDivElement, chatId: number, s: Chats.ChatsState) => {
  const bucket = s.messages[chatId];
  if (!bucket || bucket.items.length === 0 || !bucket.loading) {
    Chats.loadMessages(chatId);
    const loadingEl = domElem("div", { class: "text-gray-400", text: "Loading messages..." });
    conversation.appendChild(loadingEl);
    return;
  }

  const wrap = domElem("div", { class: "flex flex-col h-[60vh]" });
  const scroll = domElem("div", { class: "flex-1 overflow-auto space-y-2 pr-2" });
  const meId = auth.get().me?.id;

  bucket.items.forEach((m) => {
    const bubble = domElem("div", { class: `max-w-[70%] px-3 py-2 rounded-xl ${m.author_id === meId ? "bg-indigo-100 self-end" : "bg-gray-100"}` });
    bubble.textContent = m.body;
    scroll.appendChild(bubble);
  });

  return { wrap, scroll };
};

const renderWritingBox = (chatId: number) => {
  const form = domElem("form", { class: "mt-3 flex gap-2" });
  const input = domElem("input", { class: "flex-1 px-3 py-2 rounded-xl border border-gray-200", attributes: { placeholder: "Type a message..." } });
  const sendBtn = Button("Send", { type: "submit" });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = (input as HTMLInputElement).value.trim();
    if (!body) return;
    sendBtn.setAttribute("disabled", "true");
    try {
      await Chats.sendMessage(chatId, body);
      (input as HTMLInputElement).value = "";
    } finally {
      sendBtn.removeAttribute("disabled");
    }
  });

  form.append(input, sendBtn);
  return { form, input, sendBtn };
};

const renderConversation = (conversation: HTMLDivElement, id: number, s: Chats.ChatsState) => {
  conversation.replaceChildren();
  const chatId = Number.isFinite(id) && id > 0 ? id : s.list[0]?.id;
  if (!chatId) {
    const noChat = domElem("div", { class: "text-gray-500", text: "No chat selected" });
    conversation.appendChild(noChat);
    return;
  }

  const previousMessages = loadPreviousMessages(conversation, chatId, s);
  if (previousMessages === undefined) return;

  const writingBox = renderWritingBox(chatId);
  mount(previousMessages.wrap, previousMessages.scroll, writingBox.form);
  conversation.appendChild(previousMessages.wrap);
};

const bindChatsView = (chatList: HTMLDivElement, conversation: HTMLDivElement, chatId: number) => {
  return bind(Chats.chats, (s) => {
    renderChatList(chatList, s);
    renderConversation(conversation, chatId, s);
  });
};

export const ChatsView = (root: HTMLElement, params: Record<string, string>) => {
  const title = domElem("h2", { class: "text-2xl font-semibold mb-4", text: "Chats" });
  const grid = domElem("div", { class: "grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4" });

  const chatList = Card();
  const conversation = Card();

  mount(grid, chatList, conversation);
  mount(root, title, grid);
  Chats.loadMyChats();

  const unbindChatsView = bindChatsView(chatList, conversation, Number(params.id));

  return () => {
    unbindChatsView();
  };
};
