/******************************************************************
 *  2-Factor Authentication (TOTP) views – robust & backend-agnostic
 *  - URLs relatives (/api/…) => Nginx proxy (pas de CORS)
 *  - Délégation d'événements
 *  - Fallbacks d'API (auth/2fa/* ou 2fa/* ou login/2fa)
 ******************************************************************/

import { navigateTo } from "./navigation";
import { t } from "./i18n";

const API = "/api"; // IMPORTANT: relatif

/* Helpers ------------------------------------------------------------------ */

async function readJsonSafe(r: Response): Promise<any> {
  const text = await r.text().catch(() => "");
  try { return text ? JSON.parse(text) : {}; } catch { return { _raw: text }; }
}

function showLog(el: HTMLElement | null, msg: string) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

async function firstOk(
  calls: Array<() => Promise<Response>>,
): Promise<{ r: Response; data: any } | null> {
  for (const call of calls) {
    try {
      const r = await call();
      if (r.ok) {
        const data = await readJsonSafe(r);
        return { r, data };
      }
    } catch { /* ignore and try next */ }
  }
  return null;
}

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

        <pre id="twofa-log" class="text-sm bg-yellow-50 text-yellow-900 rounded p-2 hidden"></pre>
      </div>
    </div>
  `;

  const logEl = container.querySelector<HTMLPreElement>("#twofa-log");

  container.addEventListener(
    "click",
    async (ev) => {
      const el = ev.target as HTMLElement;
      if (!el) return;

      // Set up now
      if (el.closest("#now")) {
        ev.preventDefault();
        // Certains backends requièrent un "start"
        await firstOk([
          () => fetch(`${API}/auth/2fa/start`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
          () => fetch(`${API}/2fa/start`,      { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
        ]);
        navigateTo("setup-2fa-qr");
        return;
      }

      // Do it later
      if (el.closest("#later")) {
        ev.preventDefault();
        const res = await firstOk([
          () => fetch(`${API}/auth/2fa/skip`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
          () => fetch(`${API}/2fa/skip`,      { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!res) {
          // Si pas d'endpoint "skip" sur ton back, on tente direct dashboard
          showLog(logEl, "No /2fa/skip endpoint. Continuing without enabling 2FA.");
          localStorage.removeItem("setup2FAToken");
          navigateTo("dashboard");
          return;
        }

        const { data } = res;
        localStorage.removeItem("setup2FAToken");
        if (data?.sessionToken) localStorage.setItem("authToken", data.sessionToken);
        navigateTo("dashboard");
        return;
      }
    },
    { capture: true }
  );
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

        <div class="flex justify-center">
          <img id="qr" class="mx-auto w-40 h-40" alt="QR"/>
        </div>

        <pre id="otpauth" class="text-xs bg-gray-900 rounded p-2 overflow-x-auto"></pre>

        <input id="code"
               class="text-black text-center p-2 rounded"
               placeholder="${await t("2fa.code_ph")}" inputmode="numeric" maxlength="6"/>

        <button id="verify"
                class="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700">
          ${await t("2fa.verify")}
        </button>

        <button id="cancel"
                class="px-6 py-3 rounded-lg bg-gray-600 hover:bg-gray-700">
          ${await t("common.cancel") ?? "Cancel"}
        </button>

        <pre id="twofa-log" class="text-sm bg-yellow-50 text-yellow-900 rounded p-2 hidden"></pre>
      </div>
    </div>
  `;

  const logEl   = container.querySelector<HTMLPreElement>("#twofa-log");
  const qrImg   = container.querySelector<HTMLImageElement>("#qr")!;
  const otpPre  = container.querySelector<HTMLPreElement>("#otpauth")!;
  const input   = container.querySelector<HTMLInputElement>("#code")!;

  // Charger QR + otpauth/secret (supporte plusieurs formats/endpoints)
  (async () => {
    const authHeader = { Authorization: `Bearer ${token}` };
    const res = await firstOk([
      // Auth routes
      () => fetch(`${API}/auth/2fa/qr`,    { headers: authHeader }),
      () => fetch(`${API}/auth/2fa/setup`, { headers: authHeader }),
      // 2fa routes
      () => fetch(`${API}/2fa/qr`,         { headers: authHeader }),
      () => fetch(`${API}/2fa/setup`,      { headers: authHeader }),
      // POST fallbacks si GET non supporté
      () => fetch(`${API}/auth/2fa/qr`,    { method: "POST", headers: { ...authHeader, "Content-Type": "application/json" }, body: "{}" }),
      () => fetch(`${API}/auth/2fa/setup`, { method: "POST", headers: { ...authHeader, "Content-Type": "application/json" }, body: "{}" }),
      () => fetch(`${API}/2fa/qr`,         { method: "POST", headers: { ...authHeader, "Content-Type": "application/json" }, body: "{}" }),
      () => fetch(`${API}/2fa/setup`,      { method: "POST", headers: { ...authHeader, "Content-Type": "application/json" }, body: "{}" }),
    ]);

    if (!res) {
      showLog(logEl, "No QR endpoint responded 200");
      return;
    }

    const { data } = res;
    // Image QR
    if (data.qr) qrImg.src = data.qr;
    else if (data.qr_data_url) qrImg.src = data.qr_data_url;
    else if (data.qr_svg) qrImg.src = "data:image/svg+xml;utf8," + encodeURIComponent(data.qr_svg);
    else showLog(logEl, "No QR provided by server");

    // otpauth/secret (affichage facultatif)
    if (data.otpauth_url) otpPre.textContent = data.otpauth_url;
    else if (data.secret) otpPre.textContent = `secret: ${data.secret}`;
    else otpPre.textContent = "";
  })();

  // Actions
  container.addEventListener(
    "click",
    async (ev) => {
      const el = ev.target as HTMLElement;
      if (!el) return;

      if (el.closest("#cancel")) {
        ev.preventDefault();
        navigateTo("dashboard");
        return;
      }

      if (el.closest("#verify")) {
        ev.preventDefault();
        const code = input.value.replace(/\D/g, "").slice(0, 6);
        if (code.length !== 6) return alert(await t("2fa.code_error"));

        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
        const body    = JSON.stringify({ code });

        const res = await firstOk([
          () => fetch(`${API}/auth/2fa/verify`, { method: "POST", headers, body }),
          () => fetch(`${API}/2fa/verify`,      { method: "POST", headers, body }),
          // certains backends utilisent /2fa/enable
          () => fetch(`${API}/2fa/enable`,      { method: "POST", headers, body }),
        ]);

        if (!res) {
          showLog(logEl, "No /verify endpoint accepted the code");
          alert("Verify error");
          return;
        }

        const { r, data } = res;
        showLog(logEl, `${r.status} ${r.statusText}${data ? "\n" + JSON.stringify(data).slice(0, 200) : ""}`);

        localStorage.removeItem("setup2FAToken");
        if (data?.sessionToken) localStorage.setItem("authToken", data.sessionToken);
        navigateTo("dashboard");
        return;
      }
    },
    { capture: true }
  );

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      (container.querySelector("#verify") as HTMLButtonElement)?.click();
    }
  });
}

/******************************************************************
 *  3) Login challenge (enter code after Google/password login)
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
               placeholder="${await t("2fa.code_ph")}" inputmode="numeric" maxlength="6"/>

        <button id="verify"
                class="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700">
          ${await t("2fa.verify")}
        </button>

        <button id="cancel-login-2fa"
                class="px-6 py-3 rounded-lg bg-gray-600 hover:bg-gray-700">
          ${await t("common.cancel") ?? "Cancel"}
        </button>

        <pre id="twofa-log" class="text-sm bg-yellow-50 text-yellow-900 rounded p-2 hidden"></pre>
      </div>
    </div>
  `;

  const input = container.querySelector<HTMLInputElement>("#code")!;
  const logEl = container.querySelector<HTMLPreElement>("#twofa-log");

  container.addEventListener(
    "click",
    async (ev) => {
      const el = ev.target as HTMLElement;
      if (!el) return;

      if (el.closest("#cancel-login-2fa")) {
        ev.preventDefault();
        navigateTo("login");
        return;
      }

      if (el.closest("#verify")) {
        ev.preventDefault();
        const code = input.value.replace(/\D/g, "").slice(0, 6);
        if (code.length !== 6) return alert(await t("2fa.code_error"));

        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
        const body    = JSON.stringify({ code });

        const res = await firstOk([
          () => fetch(`${API}/auth/2fa/login-verify`, { method: "POST", headers, body }),
          () => fetch(`${API}/login/2fa`,             { method: "POST", headers, body }),
          () => fetch(`${API}/2fa/login-verify`,      { method: "POST", headers, body }),
        ]);

        if (!res) {
          showLog(logEl, "No login-verify endpoint accepted the code");
          alert("Verify error");
          return;
        }

        const { r, data } = res;
        showLog(logEl, `${r.status} ${r.statusText}${data ? "\n" + JSON.stringify(data).slice(0, 200) : ""}`);

        localStorage.removeItem("challengeToken");
        if (data?.sessionToken) localStorage.setItem("authToken", data.sessionToken);
        navigateTo("dashboard");
        return;
      }
    },
    { capture: true }
  );

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      (container.querySelector("#verify") as HTMLButtonElement)?.click();
    }
  });
}
