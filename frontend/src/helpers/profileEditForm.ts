// src/helpers/profileEditForm.ts
import { domElem, mount } from "../ui/DomElement";
import { Button } from "../ui/Button";
import { LabeledInput } from "../ui/Input";
import { AvatarPicker, type AvatarIntent } from "./avatarPicker";

export type FormInitial = { pseudo: string; email: string; avatarUrl: string | null };
export type FormPayload = { pseudo?: string; email?: string; avatarFile?: File | null; deleteAvatar?: boolean };
export type FormOptions = { onSubmit: (p: FormPayload) => Promise<void> | void; onCancel: () => void };

export function ProfileEditForm(initial: FormInitial, opts: FormOptions) {
  const form = domElem("form", { class: "flex flex-col gap-4" });

  const avatar = AvatarPicker(initial.avatarUrl);
  const pseudo = LabeledInput("Pseudo", { value: initial.pseudo });
  const email = LabeledInput("Email", { value: initial.email });

  const actions = domElem("div", { class: "flex items-center justify-end gap-2 pt-2" });
  const cancel = Button("Cancel", {
    variant: "ghost",
    onClick: (e) => {
      e.preventDefault();
      opts.onCancel();
    },
  });
  const save = Button("Save Changes", { variant: "primary", type: "submit" });

  mount(actions, cancel, save);
  mount(form, avatar.el, pseudo.labelWrapper, email.labelWrapper, actions);

  function isDirty(ai: AvatarIntent) {
    const p = (pseudo.input as HTMLInputElement).value;
    const e = (email.input as HTMLInputElement).value;
    return p !== initial.pseudo || e !== initial.email || ai.file !== undefined || ai.delete === true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ai = avatar.intent();
    if (!isDirty(ai)) return;

    const p: FormPayload = {};
    const nextP = (pseudo.input as HTMLInputElement).value.trim();
    const nextE = (email.input as HTMLInputElement).value.trim();

    if (nextP !== initial.pseudo) p.pseudo = nextP;
    if (nextE !== initial.email) p.email = nextE;
    if (ai.delete) p.deleteAvatar = true;
    if (ai.file) p.avatarFile = ai.file;

    await opts.onSubmit(p);
  });

  function dispose() {
    avatar.dispose();
  }

  return { wrap: form, dispose };
}
