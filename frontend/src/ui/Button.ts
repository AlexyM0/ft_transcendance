// src/ui/Button.ts
import { domElem } from "./DomElement";

export function Button(
  label: string,
  options: {
    onClick?: (e: MouseEvent) => void;
    variant?: "primary" | "ghost" | "danger" | "login" | "loginSmall" | "oauth";
    type?: "button" | "submit";
    leading?: HTMLElement | null;
  } = {}
) {
  const variants = {
    primary: "px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition bg-indigo-600 text-white hover:bg-indigo-500",
    ghost: "px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition bg-transparent text-indigo-600 hover:bg-indigo-50",
    danger: "px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition bg-rose-600 text-white hover:bg-rose-500",
    login: "justify-center px-4 py-5 rounded-xl text-base font-semibold transition bg-indigo-900 hover:bg-indigo-700",
    loginSmall: "justify-center px-4 py-3 rounded-xl text-base font-semibold transition bg-indigo-900 hover:bg-indigo-700",
    oauth: "w-full justify-start px-4 py-5 rounded-xl text-base font-semibold transition bg-slate-800 hover:bg-slate-500",
  };

  const btn = domElem("button", {
    class: `inline-flex items-center gap-3 ${variants[options.variant ?? "primary"]}`,
    attributes: { type: options.type ?? "button" },
  });

  if (options.leading) {
    const iconSlot = domElem("span", { class: "shrink-0 grid place-items-center mr-4" });
    iconSlot.appendChild(options.leading);
    btn.appendChild(iconSlot);
  } else {
    btn.appendChild(domElem("span", { class: "shrink-0" }));
  }

  btn.appendChild(domElem("span", { text: label }));

  if (options.onClick) {
    btn.addEventListener("click", options.onClick);
  }
  return btn;
}

export function IconButton(faSrc: string, alt: string, onClick: () => void, title?: string) {
  const btn = domElem("button", {
    class: "rounded-xl p-2 hover:bg-slate-100 transition inline-grid place-items-center",
    attributes: { type: "button", title: title ?? alt, "aria-label": alt },
  });
  const logo = domElem("i", { class: `fa-solid ${faSrc}` });
  btn.appendChild(logo);
  btn.addEventListener("click", onClick);
  return btn;
}

export function ImageButton(
  imgSrc: string,
  alt: string,
  options: {
    onClick?: (e: MouseEvent) => void;
    size?: number; // px — defaults to 36
    variant?: "plain" | "ghost" | "circle"; // style flavors
    title?: string;
  } = {}
) {
  const { onClick, size = 36, variant = "plain", title } = options;

  const variants = {
    plain: "rounded-xl border border-gray-200 hover:bg-slate-100 transition",
    ghost: "rounded-xl hover:bg-slate-100 transition",
    circle: "rounded-full hover:ring-2 hover:ring-indigo-500 transition",
  };

  const btn = domElem("button", {
    class: `inline-grid place-items-center ${variants[variant]}`,
    attributes: {
      type: "button",
      title: title ?? alt,
      "aria-label": alt,
      style: `width:${size}px;height:${size}px;`,
    },
  });

  const img = domElem("img", {
    class: "w-full h-full object-contain",
    attributes: { src: imgSrc, alt },
  });

  btn.appendChild(img);
  if (onClick) btn.addEventListener("click", onClick);
  return btn;
}
