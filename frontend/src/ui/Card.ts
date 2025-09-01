// src/ui/Card.ts
import { domElem, mount } from "./DomElement";

export function Card(...children: (HTMLElement | string)[]) {
  const card = domElem("div", { class: "bg-white/70 backdrop-blur shadow rounded-2xl p-4 border border-gray-100" });
  mount(card, ...(children as HTMLElement[]));
  return card;
}
