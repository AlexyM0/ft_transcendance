// src/views/ProfileEditForm.ts
import { domElem as h, mount } from "../ui/DomElement";
import { Button } from "../ui/Button";
import { LabeledInput } from "../ui/Input";

const DEFAULT_AVATAR_URL = "/user.png";

export type ProfileEditInitial = {
  pseudo: string;
  email: string;
  avatarUrl: string | null;
  twofaEnabled: boolean;
};

export type ProfileEditPayload = {
  pseudo?: string;
  email?: string;
  avatarFile?: File | null;
  deleteAvatar?: boolean;
};

export type ProfileEditFormOptions = {
  onSubmit: (payload: ProfileEditPayload) => Promise<void> | void;
  onCancel: () => void;

  // 2FA enable/disable + verify hooks (provided by ProfileView)
  on2faToggle: (next: "enable" | "disable") => Promise<
    | { otpauth: string; qrDataUrl: string } // enabling: return setup
    | { disabled: true }
  >;
  on2faVerify: (code: string) => Promise<{ success: true }>;
};

export function ProfileEditForm(initial: ProfileEditInitial, options: ProfileEditFormOptions) {
  // ----- Local state -----
  let avatarAction: "none" | "upload" | "delete" = "none";
  let selectedFile: File | null = null;
  let objectUrl: string | null = null;
  let twofaEnabled = initial.twofaEnabled;
  let setupQR: { otpauth: string; qrDataUrl: string } | null = null;

  // ----- DOM -----
  const wrap = h("form", { class: "flex flex-col gap-4" });

  // Avatar row
  const fileRow = h("div", { class: "flex items-center gap-5" });
  const avatar = h("img", {
    class: "w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ring-white/70 object-cover",
    attributes: {
      src: initial.avatarUrl ?? DEFAULT_AVATAR_URL,
      alt: "avatar",
    },
  }) as HTMLImageElement;

  const avatarButtons = h("div", { class: "flex flex-col items-start gap-2" });
  const pickBtn = Button("Choose image…", { variant: "ghost" });
  const deleteBtn = Button("Delete avatar", { variant: "danger" });
  const hint = h("span", { class: "text-sm text-slate-500 min-h-[1.25rem]" });
  const fileInput = h("input", { class: "hidden", attributes: { type: "file", accept: "image/*" } }) as HTMLInputElement;

  // Fields
  const nameField = LabeledInput("Pseudo", { value: initial.pseudo });
  const emailField = LabeledInput("Email", { value: initial.email });

  // 2FA section
  const twofaSection = h("div", { class: "mt-1 p-3 rounded-xl border border-emerald-100 bg-emerald-50/40 flex flex-col gap-3" });
  const twofaHeader = h("div", { class: "flex items-center justify-between" });
  const twofaLabel = h("div", { class: "font-semibold text-emerald-900", text: "Two-Factor Authentication (2FA)" });
  const twofaToggle = Button(twofaEnabled ? "Disable 2FA" : "Enable 2FA", {
    variant: twofaEnabled ? "danger" : "primary",
  });
  mount(twofaHeader, twofaLabel, twofaToggle);

  const twofaSetupWrap = h("div", { class: twofaEnabled ? "hidden" : "grid gap-2" });
  const twofaHint = h("div", { class: "text-sm text-slate-600", text: "Scan the QR with your authenticator app, then enter the 6-digit code." });
  const qrImg = h("img", { class: "w-40 h-40 rounded border border-emerald-200 shadow-sm hidden" }) as HTMLImageElement;
  const codeField = LabeledInput("Authentication code", { value: "" });
  const verifyBtn = Button("Verify & Enable", { variant: "primary" });

  mount(twofaSetupWrap, twofaHint, qrImg, codeField.labelWrapper, verifyBtn);

  // Actions
  const actions = h("div", { class: "flex items-center justify-end gap-2 pt-2" });
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

  // ----- Events: Avatar -----
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
    fileInput.value = "";
    previewDefault();
    setHint("Avatar will be removed on save.");
    refreshSaveState();
  });

  (nameField.input as HTMLInputElement).addEventListener("input", refreshSaveState);
  (emailField.input as HTMLInputElement).addEventListener("input", refreshSaveState);

  // ----- Events: 2FA -----
  twofaToggle.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      if (!twofaEnabled) {
        // Enable flow: ask backend for QR + otpauth
        const setup = await options.on2faToggle("enable");
        if ("qrDataUrl" in setup) {
          setupQR = setup;
          qrImg.src = setup.qrDataUrl;
          qrImg.classList.remove("hidden");
          twofaSetupWrap.classList.remove("hidden");
          setHint("Scan the QR, then enter the code below.");
        }
      } else {
        // Disable flow
        await options.on2faToggle("disable");
        twofaEnabled = false;
        twofaToggle.textContent = "Enable 2FA";
        twofaToggle.className = twofaToggle.className.replace("bg-rose-600", "bg-indigo-600"); // switch tone
        // Hide setup UI if it was open
        twofaSetupWrap.classList.add("hidden");
        qrImg.classList.add("hidden");
        (codeField.input as HTMLInputElement).value = "";
        setHint("2FA disabled.");
      }
    } catch (err: any) {
      setHint(err?.message ?? "2FA action failed", true);
    }
  });

  verifyBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const code = (codeField.input as HTMLInputElement).value.trim();
    if (!code) return setHint("Enter the 6-digit code.", true);
    try {
      await options.on2faVerify(code);
      twofaEnabled = true;
      twofaToggle.textContent = "Disable 2FA";
      twofaToggle.className = twofaToggle.className.replace("bg-indigo-600", "bg-rose-600");
      setHint("2FA enabled ✅");
      // collapse setup UI
      twofaSetupWrap.classList.add("hidden");
      qrImg.classList.add("hidden");
      (codeField.input as HTMLInputElement).value = "";
    } catch (err: any) {
      setHint(err?.message ?? "Verification failed", true);
    }
  });

  // ----- Submit -----
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

    if (avatarAction === "upload") payload.avatarFile = selectedFile;
    if (avatarAction === "delete") payload.deleteAvatar = true;

    try {
      await options.onSubmit(payload);
      setHint("Saved ✅");
    } catch (err: any) {
      setHint(err?.message ?? "Save failed", true);
      setTimeout(() => {
        saveBtn.removeAttribute("disabled");
        saveBtn.classList.remove("opacity-50", "cursor-not-allowed");
      }, 500);
      return;
    }

    // Update local baseline after successful save
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
  mount(twofaSection, twofaHeader, twofaSetupWrap);
  //   const actions = h("div", { class: "flex items-center justify-end gap-2 pt-2" });
  //   const cancelBtn = Button("Cancel", {
  //     variant: "ghost",
  //     onClick: (e) => {
  //       e.preventDefault();
  //       options.onCancel();
  //     },
  //   });
  mount(actions, cancelBtn, saveBtn);

  mount(wrap, fileRow, nameField.labelWrapper, emailField.labelWrapper, twofaSection, actions);

  // initialize save state
  refreshSaveState();

  // ----- API -----
  function dispose() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }

  return { wrap, dispose };
}
