// src/views/forms/ProfileEditForm.ts
import { domElem, mount } from "../ui/DomElement";
import { Button } from "../ui/Button";
import { LabeledInput } from "../ui/Input";

const DEFAULT_AVATAR_URL = "/user.png";

export type ProfileEditInitial = {
  pseudo: string;
  email: string;
  avatarUrl: string | null;
};

export type ProfileEditPayload = {
  pseudo?: string;
  email?: string;
  avatarFile?: File | null; // only sent when a new file was selected
  deleteAvatar?: boolean; // true if user asked to delete avatar
};

export type ProfileEditFormOptions = {
  onSubmit: (payload: ProfileEditPayload) => Promise<void> | void;
  onCancel: () => void;
};

export function ProfileEditForm(initial: ProfileEditInitial, options: ProfileEditFormOptions) {
  // ----- State (local UI only) -----
  let avatarAction: "none" | "upload" | "delete" = "none";
  let selectedFile: File | null = null;
  let objectUrl: string | null = null;

  // ----- DOM -----
  const wrap = domElem("form", { class: "flex flex-col gap-4" });

  // Avatar row
  const fileRow = domElem("div", { class: "flex items-center gap-5" });

  const avatar = domElem("img", {
    class: "w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ring-white/70 object-cover",
    attributes: {
      src: initial.avatarUrl ?? DEFAULT_AVATAR_URL,
      alt: "avatar",
    },
  }) as HTMLImageElement;

  const avatarButtons = domElem("div", { class: "flex flex-col items-start gap-2" });
  const pickBtn = Button("Choose image…", { variant: "ghost" });
  const deleteBtn = Button("Delete avatar", { variant: "danger" });
  const hint = domElem("span", { class: "text-sm text-slate-500 min-h-[1.25rem]" });

  const fileInput = domElem("input", { class: "hidden", attributes: { type: "file", accept: "image/*" } }) as HTMLInputElement;

  // Fields
  const nameField = LabeledInput("Pseudo", { value: initial.pseudo });
  const emailField = LabeledInput("Email", { value: initial.email });

  // Actions
  const actions = domElem("div", { class: "flex items-center justify-end gap-2 pt-2" });
  const cancelBtn = Button("Cancel", {
    variant: "ghost",
    onClick: (e) => {
      e.preventDefault();
      options.onCancel();
    },
  });
  const saveBtn = Button("Save Changes", { variant: "primary", type: "submit" });

  // ----- Helpers -----
  function setHint(msg: string, isError = false) {
    hint.textContent = msg;
    hint.classList.toggle("text-rose-600", isError);
    hint.classList.toggle("text-slate-500", !isError);
  }

  function revokePreview() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function previewFile(file: File) {
    revokePreview();
    objectUrl = URL.createObjectURL(file);
    avatar.src = objectUrl;
  }

  function previewDefault() {
    revokePreview();
    avatar.src = DEFAULT_AVATAR_URL;
  }

  function isDirty(): boolean {
    const pseudoDirty = (nameField.input as HTMLInputElement).value !== initial.pseudo;
    const emailDirty = (emailField.input as HTMLInputElement).value !== initial.email;
    const avatarDirty = avatarAction !== "none";
    return pseudoDirty || emailDirty || avatarDirty;
  }

  function refreshSaveState() {
    if (isDirty()) {
      saveBtn.removeAttribute("disabled");
      saveBtn.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
      saveBtn.setAttribute("disabled", "true");
      saveBtn.classList.add("opacity-50", "cursor-not-allowed");
    }
  }

  // ----- Events -----
  pickBtn.addEventListener("click", (e) => {
    e.preventDefault();
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0] ?? null;
    if (!file) return;
    selectedFile = file;
    avatarAction = "upload";
    previewFile(file);
    setHint("Image selected (not saved yet).");
    refreshSaveState();
  });

  deleteBtn.addEventListener("click", (e) => {
    e.preventDefault();
    selectedFile = null;
    avatarAction = "delete";
    fileInput.value = ""; // clear file input
    previewDefault();
    setHint("Avatar will be removed on save.");
    refreshSaveState();
  });

  (nameField.input as HTMLInputElement).addEventListener("input", () => {
    refreshSaveState();
  });
  (emailField.input as HTMLInputElement).addEventListener("input", () => {
    refreshSaveState();
  });

  wrap.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isDirty()) return;

    saveBtn.setAttribute("disabled", "true");
    saveBtn.classList.add("opacity-50", "cursor-not-allowed");
    setHint("Saving…");

    const payload: ProfileEditPayload = {};
    const nextPseudo = (nameField.input as HTMLInputElement).value.trim();
    const nextEmail = (emailField.input as HTMLInputElement).value.trim();

    if (nextPseudo !== initial.pseudo) payload.pseudo = nextPseudo;
    if (nextEmail !== initial.email) payload.email = nextEmail;

    if (avatarAction === "upload") {
      payload.avatarFile = selectedFile;
    } else if (avatarAction === "delete") {
      payload.deleteAvatar = true;
    }

    try {
      await options.onSubmit(payload);
      setHint("Saved ✅");
    } catch (err: any) {
      setHint(err?.message ?? "Save failed", true);
      // keep button disabled state for a beat, then re-enable
      setTimeout(() => {
        saveBtn.removeAttribute("disabled");
        saveBtn.classList.remove("opacity-50", "cursor-not-allowed");
      }, 500);
      return;
    }

    // Optional: reset internal "initial" after successful save
    if (payload.pseudo !== undefined) initial.pseudo = payload.pseudo;
    if (payload.email !== undefined) initial.email = payload.email;
    if (payload.deleteAvatar) initial.avatarUrl = null;
    if (payload.avatarFile) initial.avatarUrl = avatar.src;

    avatarAction = "none";
    selectedFile = null;
    fileInput.value = "";
    refreshSaveState();
  });

  // ----- Mount -----
  mount(avatarButtons, pickBtn, deleteBtn);
  mount(fileRow, avatar, avatarButtons, hint, fileInput);
  mount(actions, cancelBtn, saveBtn);
  mount(wrap, fileRow, nameField.labelWrapper, emailField.labelWrapper, actions);

  // initialize save state
  refreshSaveState();

  // ----- API -----
  function dispose() {
    revokePreview();
  }

  return { wrap, dispose };
}
