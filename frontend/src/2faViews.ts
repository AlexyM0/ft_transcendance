import { navigateTo } from "./navigation";
import { t } from "./i18n";

// IMPORTANT: ces routes ne sont PAS sous /api
// 2faViews.ts
const AUTH2FA_QR      = "/api/auth/2fa/qr";
const AUTH2FA_VERIFY  = "/api/auth/2fa/verify";
const AUTH2FA_SKIP    = "/api/auth/2fa/skip";
const AUTH2FA_LOGINVF = "/api/auth/2fa/login-verify";


/******************************************************************
 *  1) Choix: configurer maintenant ou plus tard
 ******************************************************************/
export async function renderSetup2FAChoice(container: HTMLElement) {
  const token = localStorage.getItem("setup2FAToken");
  if (!token) return navigateTo("signup");

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div class="flex flex-col gap-6 bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 class="text-xl font-semibold text-center">${await t("2fa.choice_title")}</h1>
        <button id="now"   class="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700">${await t("2fa.now")}</button>
        <button id="later" class="px-6 py-3 rounded-lg underline">${await t("2fa.later")}</button>
      </div>
    </div>
  `;

  container.querySelector("#now")?.addEventListener("click", () => navigateTo("setup-2fa-qr"));

  container.querySelector("#later")?.addEventListener("click", async () => {
    try {
      const r = await fetch(AUTH2FA_SKIP, { method: "POST", headers: { Authorization: `Bearer ${token}` }});
      const d = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(d.error || "skip error");

      localStorage.removeItem("setup2FAToken");
      if (d.sessionToken) localStorage.setItem("authToken", d.sessionToken);
      navigateTo("dashboard");
    } catch (e:any) {
      alert(e.message || "skip error");
    }
  });
}

/******************************************************************
 *  2) Ecran QR
 ******************************************************************/
export async function renderSetup2FAQr(container: HTMLElement) {
  const token = localStorage.getItem("setup2FAToken");
  if (!token) return navigateTo("signup");

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div class="flex flex-col gap-6 bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 class="text-xl font-semibold text-center">${await t("2fa.qr_title")}</h1>

        <div id="qr-box" class="bg-white rounded p-3 flex items-center justify-center min-h-[180px]">
          <span class="text-black text-sm">Loading QR…</span>
        </div>

        <input id="code" class="text-black text-center p-2 rounded" placeholder="${await t("2fa.code_ph")}" inputmode="numeric" maxlength="6"/>

        <button id="verify" class="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700">${await t("2fa.verify")}</button>
        <button id="skip"   class="px-6 py-3 rounded-lg bg-gray-600 hover:bg-gray-700">${await t("2fa.later")}</button>
      </div>
    </div>
  `;

  // Récupération du QR (le back renvoie { qr: "data:image/png;base64,..." })
  try {
    const r = await fetch(AUTH2FA_QR, { headers: { Authorization: `Bearer ${token}` }});
    const d = await r.json().catch(() => ({} as any));
    if (!r.ok || !d.qr) throw new Error(d.error || "No QR");

    const box = container.querySelector<HTMLDivElement>("#qr-box")!;
    box.innerHTML = `<img src="${d.qr}" alt="QR" class="w-40 h-40" />`;
  } catch (e:any) {
    const box = container.querySelector<HTMLDivElement>("#qr-box")!;
    box.innerHTML = `<span class="text-black text-sm">${e.message || "Cannot load QR"}</span>`;
  }

  container.querySelector("#verify")?.addEventListener("click", async () => {
    const code = (container.querySelector("#code") as HTMLInputElement).value.trim();
    if (!/^\d{6}$/.test(code)) return alert(await t("2fa.code_error"));

    try {
      const r = await fetch(AUTH2FA_VERIFY, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const d = await r.json().catch(() => ({} as any));
      if (!r.ok || !d.sessionToken) throw new Error(d.error || "Verify failed");

      localStorage.removeItem("setup2FAToken");
      localStorage.setItem("authToken", d.sessionToken);
      navigateTo("dashboard");
    } catch (e:any) {
      alert(e.message || "Verify failed");
    }
  });

  container.querySelector("#skip")?.addEventListener("click", async () => {
    try {
      const r = await fetch(AUTH2FA_SKIP, { method: "POST", headers: { Authorization: `Bearer ${token}` }});
      const d = await r.json().catch(() => ({} as any));
      localStorage.removeItem("setup2FAToken");
      if (d.sessionToken) localStorage.setItem("authToken", d.sessionToken);
      navigateTo("dashboard");
    } catch {
      localStorage.removeItem("setup2FAToken");
      navigateTo("dashboard");
    }
  });
}

/******************************************************************
 *  3) Login challenge (2FA)
 ******************************************************************/
export async function renderLogin2FACode(container: HTMLElement) {
  const token = localStorage.getItem("challengeToken");
  if (!token) return navigateTo("login");

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div class="flex flex-col gap-6 bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 class="text-xl font-semibold text-center">${await t("2fa.login_title")}</h1>

        <input id="code" class="text-black text-center p-2 rounded" placeholder="${await t("2fa.code_ph")}" inputmode="numeric" maxlength="6"/>

        <button id="verify" class="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700">${await t("2fa.verify")}</button>
      </div>
    </div>
  `;

  container.querySelector("#verify")?.addEventListener("click", async () => {
    const code = (container.querySelector("#code") as HTMLInputElement).value.trim();
    if (!/^\d{6}$/.test(code)) return alert(await t("2fa.code_error"));

    try {
      const r = await fetch(AUTH2FA_LOGINVF, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const d = await r.json().catch(() => ({} as any));
      if (!r.ok || !d.sessionToken) throw new Error(d.error || "Verify failed");

      localStorage.removeItem("challengeToken");
      localStorage.setItem("authToken", d.sessionToken);
      navigateTo("dashboard");
    } catch (e:any) {
      alert(e.message || "Verify failed");
    }
  });
}
