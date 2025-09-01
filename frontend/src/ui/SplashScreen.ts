// src/ui/SplashScreen.ts

import { domElem, mount } from "./DomElement";

export type SplashScreen = {
  backdrop: HTMLDivElement;
  open: () => void;
  close: () => void;
  setContent: (content: HTMLElement) => void;
};

export function createSplashScreen(splashTitle: string): SplashScreen {
  const backdrop = domElem("div", { class: "fixed inset-0 bg-black/40 backdrop-blur-sm z-50 hidden", attributes: { role: "dialog", "aria-model": "true" } });

  const sheet = domElem("div", { class: "absolue inset-0 grid place-items-center p-4" });
  const panel = domElem("div", { class: "w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden" });

  const header = domElem("div", { class: "px-5 py-3 flex items-center justify-between bg-slate-50/70" });
  const title = domElem("div", { class: "text-lg font-semibold text-slate-800", text: splashTitle });
  const closeBtn = domElem("button", { class: "p-2 rounded hover:bg-slate-100", attributes: { "aria-label": "Close" } });
  closeBtn.append(domElem("i", { class: "fa-solid fa-xmark" }));
  mount(header, title, closeBtn);

  const body = domElem("div", { class: "p-5" });

  panel.append(header, body);
  sheet.append(panel);
  backdrop.append(sheet);

  function open() {
    backdrop.classList.remove("hidden");
    setTimeout(() => closeBtn.focus(), 0);
  }

  function close() {
    backdrop.classList.add("hidden");
  }

  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop || e.target === sheet) close();
  });

  // Close panel if click outside the panel or escape key
  document.addEventListener("keydown", (e) => {
    if (!backdrop.classList.contains("hidden") && e.key == "Escape") close();
  });

  function setContent(node: HTMLElement) {
    body.replaceChildren(node);
  }

  return {
    backdrop,
    open,
    close,
    setContent,
  };
}
