// src/views/LoginView.ts
import { domElem, mount, bind } from "../ui/DomElement";
import { Button } from "../ui/Button";
import { LabeledInput } from "../ui/Input";
import { Icon } from "../ui/Icons";
import { auth, register, login, verify2faLogin } from "../store/auth.store";
import { AuthAPI } from "../api/auth";

type Mode = "menu" | "login" | "register" | "twofa";

/* ----- Left Column building blocks ------ */

const OAuthButtons = () => {
  const box = domElem("div", { class: "flex flex-col gap-3" });
  const github = Button("Login with Github", { variant: "oauth", leading: Icon("/github_logo.svg", "github_logo"), onClick: () => AuthAPI.startGithubOAuth() });
  const google = Button("Login with Google", { variant: "oauth", leading: Icon("/google_logo.svg", "github_logo"), onClick: () => AuthAPI.startGoogleOAuth() });
  const fortyTwo = Button("Login with 42", { variant: "oauth", leading: Icon("/42_logo.svg", "github_logo"), onClick: () => AuthAPI.start42OAuth() });
  box.append(github, google, fortyTwo);

  return box;
};

const LeftMenu = (onShowLogin: () => void, onShowRegister: () => void) => {
  const box = domElem("div", { class: "flex flex-col gap-4" });
  const loginBtn = Button("Login", { variant: "login", onClick: onShowLogin });
  const registerBtn = Button("Register", { variant: "login", onClick: onShowRegister });
  const divider = domElem("div", { class: "h-px my-2" });
  box.append(registerBtn, loginBtn, divider, OAuthButtons());
  return box;
};

const RegisterForm = (onShowMenu: () => void) => {
  const emailField = LabeledInput("Email", { name: "email", placeholder: "you@example.com" });
  const pseudoField = LabeledInput("Pseudo", { name: "pseudo", placeholder: "CoolPlayer" });
  const passwordField = LabeledInput("Password", { type: "password", name: "password", placeholder: "•••••••" });

  const successOrError = domElem("div", { text: "" });
  const registerBtn = Button("Create account", { variant: "loginSmall", type: "submit" });
  const backbtn = Button("Back", { variant: "loginSmall", onClick: onShowMenu });

  const form = domElem("form", { class: "flex flex-col gap-3" });
  mount(form, emailField.labelWrapper, pseudoField.labelWrapper, passwordField.labelWrapper, successOrError, registerBtn, backbtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    successOrError.textContent = "";
    successOrError.className = "";
    const email = emailField.input.value.trim();
    const pseudo = pseudoField.input.value.trim();
    const password = passwordField.input.value;
    try {
      await register(email, pseudo, password);
      successOrError.classList.add("text-sm", "text-green-600", "min-h-[1.25rem]");
      successOrError.textContent = `User ${pseudo} successfully created`;
    } catch (e: any) {
      successOrError.classList.add("text-sm", "text-rose-600", "min-h-[1.25rem]");
      successOrError.textContent = e?.message ?? "Registration failed";
    }
  });

  return { form, successOrError };
};

const LoginForm = (onShowMenu: () => void) => {
  const idField = LabeledInput("Email or Pseudo", { name: "id", placeholder: "CoolPlayer or example@mail.com" });
  const pwField = LabeledInput("Password", { type: "password", name: "pw", placeholder: "••••••••" });
  const err = domElem("div", { class: "text-sm text-rose-600 min-h-[1.25rem]" });
  const submit = Button("Sign in", { variant: "loginSmall", type: "submit" });
  const backbtn = Button("Back", { variant: "loginSmall", onClick: onShowMenu });

  const form = domElem("form", { class: "flex flex-col gap-3" });
  mount(form, idField.labelWrapper, pwField.labelWrapper, err, submit, backbtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    submit.setAttribute("disabled", "true");
    submit.classList.add("opacity-60", "cursor-not-allowed");

    try {
      await login((idField.input as HTMLInputElement).value, (pwField.input as HTMLInputElement).value);
      if (!auth.get().twofaRequired) location.hash = "/home";
    } catch (e: any) {
      err.textContent = e?.message ?? "Login failed";
    } finally {
      submit.removeAttribute("disabled");
      submit.classList.remove("opacity-60", "cursor-not-allowed");
    }
  });

  return { form, err };
};

const TwofaForm = () => {
  const codeField = LabeledInput("2FA Code", { name: "code", placeholder: "123 456" });
  const submit = Button("Verify", { type: "submit" });
  const err = domElem("div", { class: "text-sm text-rose-600 min-h-[1.25rem]" });

  const form = domElem("form", { class: "flex flex-col gap-3 hidden" });
  mount(form, codeField.labelWrapper, err, submit);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    try {
      await verify2faLogin((codeField.input as HTMLInputElement).value);
      location.hash = "/home";
    } catch (e: any) {
      err.textContent = e?.message ?? "Verification failed";
    }
  });

  return { form, err };
};

/* -------- Right Column -------- */

const RightPanel = () => {
  const box = domElem("div", { class: "h-full w-full relative overflow-hidden" });

  const header = domElem("div", { class: "p-8" });
  const title = domElem("h1", { class: "text-3xl md:text-4xl font-semibold text-white drop-shadow", text: "Transcendance" });
  const subtitle = domElem("p", { class: "text-slate-200 mt-2", text: "Play Pong, chat with friends, climb tournaments." });

  const imgWrap = domElem("div", { class: "absolute inset-0 z-10" });
  const img = domElem("img", {
    class: "w-full h-full object-cover opacity-30",
    attributes: { src: "/login_background_img.jpg", alt: "Pong Background" },
  });

  mount(imgWrap, img);
  mount(header, title, subtitle);
  mount(box, imgWrap, header);
  return box;
};

/* ------ Helpers ----- */
const show = (el: HTMLElement) => el.classList.remove("hidden");
const hide = (el: HTMLElement) => el.classList.add("hidden");

/* ---- Login View ----- */

export const LoginView = (root: HTMLElement) => {
  // Full-bleed split layout
  root.className = "min-h-screen grid md:grid-cols-[420px_1fr] bg-slate-900 text-slate-100";

  // LEFT: dark panel with menu/forms
  const left = domElem("div", { class: "min-h-screen bg-slate-950/60 backdrop-blur px-12 py-8 flex flex-col justify-center" });
  const leftInner = domElem("div"); // keeps spacing/polish consistent
  leftInner.classList.add("border-white/10", "text-slate-100");
  const header = domElem("div", { class: "mb-10 flex justify-center" });
  header.append(domElem("div", { class: "text-lg font-semibold", text: "Welcome" }));

  // Sections
  const menuSection = LeftMenu(
    () => setMode("login"),
    () => setMode("register")
  );

  const loginSection = domElem("div", { class: "flex flex-col gap-3 hidden" });
  const loginTitle = domElem("div", { class: "text-base font-semibold text-slate-200", text: "Login" });
  const loginForm = LoginForm(() => setMode("menu"));
  const loginOAuth = OAuthButtons();
  loginOAuth.classList.add("mt-2");
  mount(loginSection, loginTitle, loginForm.form, domElem("div", { class: "h-px bg-slate-700 my-2" }), loginOAuth);

  const twofaSection = domElem("div", { class: "flex flex-col gap-3 hidden" });
  const twofaTitle = domElem("div", { class: "text-sm font-semibold text-slate-200", text: "Two-Factor Authentication" });
  const twofaForm = TwofaForm();
  mount(twofaSection, twofaTitle, twofaForm.form);

  const registerSection = domElem("div", { class: "flex flex-col gap-3 hidden" });
  const registerTitle = domElem("div", { class: "text-base font-semibold text-slate-200", text: "Create your account" });
  const registerForm = RegisterForm(() => setMode("menu"));
  const registerOAuth = OAuthButtons();
  registerOAuth.classList.add("mt-2");
  mount(registerSection, registerTitle, registerForm.form, domElem("div", { class: "h-px bg-slate-700 my-2" }), registerOAuth);

  // Compose left card
  mount(leftInner, header, menuSection, loginSection, twofaSection, registerSection);
  left.appendChild(leftInner);

  // RIGHT: title + background image
  const right = RightPanel();

  // Mount to root
  mount(root, left, right);

  /* ---- Mode switching ---- */

  let mode: Mode = "menu";

  function setMode(next: Mode) {
    mode = next;

    // hide everything
    hide(menuSection);
    hide(loginSection);
    hide(twofaSection);
    hide(registerSection);

    // show one
    if (mode === "menu") show(menuSection);
    if (mode === "login") show(loginSection);
    if (mode === "twofa") show(twofaSection);
    if (mode === "register") show(registerSection);
  }

  // Initial state
  setMode("menu");

  // React to auth (2FA flips us into twofa when needed; else keep chosen tab)
  const stop = bind(auth, (s) => {
    if (s.twofaRequired) setMode("twofa");
  });

  return () => stop();
};
