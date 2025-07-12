/******************************************************************
 *  Login view – internationalised
 ******************************************************************/

import { navigateTo } from "./navigation";
import { t } from "./i18n";
/* global google */

export async function renderLoginView(container: HTMLElement) {
  container.innerHTML = /* html */ `
    <div class="relative flex justify-center items-center min-h-screen text-white bg-gradient-to-br from-black via-gray-900 to-gray-800 overflow-hidden">
      <div id="login-options" class="flex flex-col text-center space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <input id="input-email" type="email"
               placeholder="${await t("login.email_ph")}"
               class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white" />

        <input id="input-password" type="password"
               placeholder="${await t("login.password_ph")}"
               class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white" />

        <button id="btn-google"
                class="w-full px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition">
          ${await t("login.google")}
        </button>

        <button id="btn-signin"
                class="w-full px-6 py-3 bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
          ${await t("login.signin")}
        </button>

        <button id="btn-to-signup"
                class="w-full text-sm text-blue-600 hover:underline dark:text-blue-400">
          ${await t("login.goto_signup")}
        </button>
      </div>
    </div>
  `;

  document
    .getElementById("btn-signin")
    ?.addEventListener("click", handleSigninButton);

  document
    .getElementById("btn-to-signup")
    ?.addEventListener("click", () => navigateTo("signup"));

  document
    .getElementById("btn-google")
    ?.addEventListener("click", () => {
      google?.accounts?.id && google.accounts.id.prompt();
    });
}

/* ---------- Classic sign-in ---------- */
async function handleSigninButton() {
  const email     = (document.getElementById("input-email") as HTMLInputElement)?.value.trim();
  const password  = (document.getElementById("input-password") as HTMLInputElement)?.value.trim();

  if (!email || !password) {
    alert(await t("login.required"));
    return;
  }

  try {
    const res  = await fetch("http://localhost:3000/api/login", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok) {
      localStorage.setItem("authToken", data.sessionToken ?? data.token);
      alert(await t("login.success"));
      navigateTo("home");
    } else {
      alert(data.error || (await t("login.error")));
    }
  } catch {
    alert(await t("network_error"));
  }
}
