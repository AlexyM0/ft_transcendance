// src/helpers/avatarPicker.ts
import { domElem, mount } from "../ui/DomElement";
import { Button } from "../ui/Button";

const DEFAULT_AVATAR_URL = "/user.png";

export type AvatarIntent = { file?: File | null; delete?: boolean };

export function AvatarPicker(initialUrl: string | null) {
  let objectUrl: string | null = null;
  let current: AvatarIntent = {};

  const wrap = domElem("div", { class: "flex items-center gap-5" });
  const img = domElem("img", {
    class: "w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ring-white/70 object-cover",
    attributes: { src: initialUrl ?? DEFAULT_AVATAR_URL, alt: "avatar" },
  }) as HTMLImageElement;

  const buttons = domElem("div", { class: "flex flex-col items-start gap-2" });
  const choose = Button("Choose image…", { variant: "ghost" });
  const remove = Button("Delete avatar", { variant: "danger" });
  const hint = domElem("span", { class: "text-sm text-slate-500 min-h-[1.25rem]" });
  const input = domElem("input", { class: "hidden", attributes: { type: "file", accept: "image/*" } }) as HTMLInputElement;

  function setHint(t: string) {
    hint.textContent = t;
  }
  function revoke() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }
  function preview(url: string) {
    img.src = url;
  }

  choose.addEventListener("click", (e) => {
    e.preventDefault();
    input.click();
  });
  input.addEventListener("change", () => {
    const f = input.files?.[0] ?? null;
    if (!f) return;
    revoke();
    objectUrl = URL.createObjectURL(f);
    preview(objectUrl);
    current = { file: f, delete: false };
    setHint("Image selected (not saved yet).");
  });
  remove.addEventListener("click", (e) => {
    e.preventDefault();
    input.value = "";
    current = { file: null, delete: true };
    preview(DEFAULT_AVATAR_URL);
    setHint("Avatar will be removed on save.");
  });

  mount(buttons, choose, remove);
  mount(wrap, img, buttons, hint, input);

  function intent(): AvatarIntent {
    return { ...current };
  }
  function dispose() {
    revoke();
  }

  return { el: wrap, intent, dispose };
}
