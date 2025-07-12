/******************************************************************
 *  2-Factor Authentication (TOTP) views – i18n ready
 ******************************************************************/

import { navigateTo } from "./navigation";
import { t } from "./i18n";

const API = "http://localhost:3000";

/******************************************************************
 *  1) Choice after signup : “Set up now” / “Later”
 ******************************************************************/
export async function renderSetup2FAChoice(container: HTMLElement) {
  const token = localStorage.getItem("setup2FAToken");
  if (!token) return navigateTo("signup");

  container.innerHTML = /* html */ `
    <div class="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div class="flex flex-col gap-6 bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 class="text-xl font-semibold text-center">${await t("2fa.choice_title")}</h1>

        <button id="now"
                class="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700">
          ${await t("2fa.now")}
        </button>

        <button id="later"
                class="px-6 py-3 rounded-lg underline">
          ${await t("2fa.later")}
        </button>
      </div>
    </div>
  `;

  document.getElementById("now")
    ?.addEventListener("click", () => navigateTo("setup-2fa-qr"));

  document.getElementById("later")
    ?.addEventListener("click", async () => {
      try {
        const r = await fetch(`${API}/auth/2fa/skip`, {
          method : "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "skip error");

        localStorage.removeItem("setup2FAToken");
        localStorage.setItem("authToken", d.sessionToken);
        navigateTo("dashboard");
      } catch (e) {
        alert((e as Error).message);
      }
    });
}

/******************************************************************
 *  2) Setup QR screen
 ******************************************************************/
export async function renderSetup2FAQr(container: HTMLElement) {
  const token = localStorage.getItem("setup2FAToken");
  if (!token) return navigateTo("signup");

  container.innerHTML = /* html */ `
    <div class="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div class="flex flex-col gap-6 bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 class="text-xl font-semibold text-center">${await t("2fa.qr_title")}</h1>

        <img id="qr" class="mx-auto w-40 h-40" />

        <input id="code"
               class="text-black text-center p-2 rounded"
               placeholder="${await t("2fa.code_ph")}" />

        <button id="verify"
                class="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700">
          ${await t("2fa.verify")}
        </button>
      </div>
    </div>
  `;

  /* QR */
  fetch(`${API}/auth/2fa/qr`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json())
    .then(d => (document.getElementById("qr") as HTMLImageElement).src = d.qr)
    .catch(async () => alert(await t("2fa.qr_error")));

  document.getElementById("verify")
    ?.addEventListener("click", async () => {
      const code = (document.getElementById("code") as HTMLInputElement).value.trim();
      try {
        const r = await fetch(`${API}/auth/2fa/verify`, {
          method : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization  : `Bearer ${token}`,
          },
          body: JSON.stringify({ code }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || await t("2fa.code_error"));

        localStorage.removeItem("setup2FAToken");
        localStorage.setItem("authToken", d.sessionToken);
        navigateTo("dashboard");
      } catch (e) {
        alert((e as Error).message);
      }
    });
}

/******************************************************************
 *  3) Login challenge
 ******************************************************************/
export async function renderLogin2FACode(container: HTMLElement) {
  const token = localStorage.getItem("challengeToken");
  if (!token) return navigateTo("login");

  container.innerHTML = /* html */ `
    <div class="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div class="flex flex-col gap-6 bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 class="text-xl font-semibold text-center">${await t("2fa.login_title")}</h1>

        <input id="code"
               class="text-black text-center p-2 rounded"
               placeholder="${await t("2fa.code_ph")}" />

        <button id="verify"
                class="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700">
          ${await t("2fa.verify")}
        </button>
      </div>
    </div>
  `;

  document.getElementById("verify")
    ?.addEventListener("click", async () => {
      const code = (document.getElementById("code") as HTMLInputElement).value.trim();
      try {
        const r = await fetch(`${API}/auth/2fa/login-verify`, {
          method : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization  : `Bearer ${token}`,
          },
          body: JSON.stringify({ code }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || await t("2fa.code_error"));

        localStorage.removeItem("challengeToken");
        localStorage.setItem("authToken", d.sessionToken);
        navigateTo("dashboard");
      } catch (e) {
        alert((e as Error).message);
      }
    });
}
