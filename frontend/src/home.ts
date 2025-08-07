/******************************************************************
 *  Home view – i18n + sélecteur de langue fonctionnel (safe)
 ******************************************************************/

import { navigateTo } from "./navigation";
import { t, setLang } from "./i18n";
import i18next from "i18next";

export async function renderHomeView(container: HTMLElement) {
  // Langue courante "safe" (évite TypeError si i18n pas encore prêt)
  const langNow =
    (i18next.resolvedLanguage ?? i18next.language ?? "en")
      .toString()
      .split("-")[0];

  // Rendu principal
  container.innerHTML = /* html */ `
    <div class="relative min-h-screen text-white bg-gradient-to-br from-black via-gray-900 to-gray-800 overflow-hidden">

      <!-- Top bar -->
      <div class="fixed top-0 left-0 right-0 z-10 backdrop-blur-lg bg-white/5 border-b border-white/10 h-16 flex items-center justify-between px-6">
        <div class="text-white text-lg font-light hidden sm:block">
          ${await t("home.about")}
        </div>

        <div class="flex items-center gap-4 ml-auto">
          <!-- Language selector -->
          <select id="lang" class="bg-transparent text-white border-none text-sm focus:outline-none">
            <option value="en" class="text-black" ${langNow === "en" ? "selected" : ""}>🇬🇧 EN</option>
            <option value="fr" class="text-black" ${langNow === "fr" ? "selected" : ""}>🇫🇷 FR</option>
            <option value="de" class="text-black" ${langNow === "de" ? "selected" : ""}>🇩🇪 DE</option>
          </select>

          <!-- Login button -->
          <button id="btn-login-1"
                  class="px-5 text-white bg-amber-600 hover:bg-amber-700 rounded-full text-lg font-semibold shadow-lg transition-all">
            ${await t("home.login")}
          </button>
        </div>
      </div>

      <!-- Hero / Title + main actions -->
      <div class="flex flex-col items-center justify-center text-center h-screen">
        <h1 class="text-7xl font-bangers text-white mb-10">
          ${await t("home.title")}
        </h1>

        <div class="flex flex-wrap gap-4">
          <button id="btn-login-2"
                  class="px-8 py-3 bg-amber-600 hover:bg-amber-700 rounded-full text-lg font-semibold shadow-lg transition-all">
            ${await t("home.login")}
          </button>

          <button id="btn-guest"
                  class="px-8 py-3 bg-gray-600 hover:bg-gray-700 rounded-full text-lg font-semibold shadow-lg transition-all">
            ${await t("home.guest")}
          </button>
        </div>
      </div>
    </div>
  `;

  /* ---------- Listeners ---------- */

  // Login
  container.querySelector("#btn-login-1")
    ?.addEventListener("click", () => navigateTo("login"));
  container.querySelector("#btn-login-2")
    ?.addEventListener("click", () => navigateTo("login"));

  // Guest (ex: va vers "user" ou ta vue invitée)
  container.querySelector("#btn-guest")
    ?.addEventListener("click", () => navigateTo("user"));

  // Sélecteur de langue
  const sel = container.querySelector<HTMLSelectElement>("#lang");
  sel?.addEventListener("change", async () => {
    try {
      await setLang(sel.value);   // si ton setLang rerend automatiquement, c’est suffisant
      // Sinon, décommente la ligne suivante pour forcer un re-render :
      // await renderHomeView(container);
    } catch (e) {
      console.error("Language switch failed:", e);
    }
  });
}
