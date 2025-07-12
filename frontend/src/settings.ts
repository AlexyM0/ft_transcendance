/******************************************************************
 *  Settings view – choose language (i18n ready)
 ******************************************************************/

import { navigateTo } from "./navigation";
import { t, setLang } from "./i18n";
import i18next from "i18next";

export async function renderSettingsView(container: HTMLElement) {
  const current = i18next.language || "en";              // langue choisie

  container.innerHTML = /* html */ `
    <div id="language-settings"
         class="flex flex-col items-center space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl">

      <div class="flex flex-col items-start space-y-4">

        <label class="flex items-center space-x-2 text-lg text-gray-900 dark:text-gray-100">
          <input type="radio" name="language" value="fr"
                 ${current === "fr" ? "checked" : ""} class="accent-blue-600" />
          <span>${await t("language.fr")}</span>
        </label>

        <label class="flex items-center space-x-2 text-lg text-gray-900 dark:text-gray-100">
          <input type="radio" name="language" value="en"
                 ${current === "en" ? "checked" : ""} class="accent-blue-600" />
          <span>${await t("language.en")}</span>
        </label>

        <label class="flex items-center space-x-2 text-lg text-gray-900 dark:text-gray-100">
          <input type="radio" name="language" value="de"
                 ${current === "de" ? "checked" : ""} class="accent-blue-600" />
          <span>${await t("language.de")}</span>
        </label>
      </div>

      <button id="btn-back"
              class="mt-6 px-8 py-3 rounded-xl bg-gray-300 text-gray-900 font-medium text-lg hover:bg-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500 transition">
        ${await t("settings.back")}
      </button>
    </div>
  `;

  /* ---------- listeners ---------- */

  // changement de langue
  document.querySelectorAll<HTMLInputElement>("input[name='language']")
    .forEach(radio => {
      radio.addEventListener("change", () => setLang(radio.value));
    });

  // retour
  document.getElementById("btn-back")
    ?.addEventListener("click", () => navigateTo("home"));
}
