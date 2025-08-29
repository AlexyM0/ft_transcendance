// src/views/HomeView.ts
import type { View } from "./AppShell";
import { domElem } from "../ui/DomElement";

export const HomeView: View = (root: HTMLElement) => {
  console.log("HomeView called");
  const h = domElem("h2", { class: "text-2xl font-semibold mb-2", text: "Welcome!" });
  const p = domElem("p", { class: "text-gray-600", text: "Queue up a match, check your friends, or jump into a chat." });
  root.append(h, p);
  return () => {};
};
