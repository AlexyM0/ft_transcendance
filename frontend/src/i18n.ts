import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18next.use(LanguageDetector).init({
  fallbackLng: "en",
  defaultNS : "common",        // ← namespace par défaut
  debug     : false,
  resources : {}
});

/** charge « common » si besoin puis traduit */
export async function t(key: string): Promise<string> {
  const baseLng = (i18next.language || "en").split("-")[0];   // en-US → en

  if (!i18next.hasResourceBundle(baseLng, "common")) {
    const resp = await fetch(`/locales/${baseLng}/common.json`);
    if (!resp.ok) {
      console.error("Missing translation file", resp.status, resp.url);
      return key;                                            // fallback visuel
    }
    i18next.addResourceBundle(baseLng, "common", await resp.json());
  }
  return i18next.t(key, { lng: baseLng });
}

/** change la langue et re-rende la page courante */
export async function setLang(lang: string) {
  await i18next.changeLanguage(lang);
  localStorage.setItem("lang", lang);
  history.replaceState(history.state, "", location.pathname);
  window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
}
