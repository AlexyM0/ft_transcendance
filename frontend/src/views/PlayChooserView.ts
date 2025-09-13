// src/views/PlayChooserView.ts
import { domElem as h, mount } from "../ui/DomElement";

export function LinkCard(to: string, title: string, subtitle?: string, scheme: "emerald" | "indigo" = "emerald") {
  const base = scheme === "emerald" ? "hover:bg-emerald-50 border-emerald-100" : "hover:bg-indigo-50 border-indigo-100";
  const a = h("a", {
    class: `block p-6 rounded-2xl border bg-white ${base}`,
    attributes: { href: `#${to}` },
  });

  const linkTitle = h("div", {
    class: scheme === "emerald" ? "text-xl font-semibold text-emerald-900" : "text-xl font-semibold text-indigo-900",
    text: title,
  });
  a.append(linkTitle);
  if (subtitle) {
    const linkSubtitle = h("div", { class: "text-sm text-slate-600 mt-1", text: subtitle });
    a.append(linkSubtitle);
  }
  return a;
}

export function PlayChooserView(root: HTMLElement) {
  //   const existing = sessionStorage.getItem("play:local:current");
  //   if (existing) {
  //     location.hash = "/play/local/m";
  //     return () => {};
  //   }
  const wrap = h("div", { class: "grid md:grid-cols-2 gap-6" });

  const local = LinkCard("/play/local", "Local Game", "Same-device duel", "emerald");
  const online = LinkCard("/play/online", "Online Game", "Invite a friend to play on remote devices", "indigo");
  const lan = LinkCard("/play/lan", "Play (LAN)", "Quick: host or join on local network", "emerald");

  mount(wrap, local, online, lan);
  root.replaceChildren(wrap);
  return () => {};
}
