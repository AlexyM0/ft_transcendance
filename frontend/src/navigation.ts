/******************************************************************
 *  Simple SPA router (history API)
 *  Ajout des nouvelles vues liées à l’auth 2FA
 ******************************************************************/

import { renderHomeView      } from "./home.ts";
import { renderLoginView     } from "./login.ts";
import { renderSignupView    } from "./signup.ts";
import { renderSettingsView  } from "./settings.ts";
import { renderUserView      } from "./userview.ts";
import { renderGameView      } from "./game.ts";

// 2FA related views
import {
  renderSetup2FAChoice,
  renderSetup2FAQr,
  renderLogin2FACode,
} from "./2faViews.ts";

let app: HTMLElement;

/******************************************************************
 *  Initialisation
 ******************************************************************/
export function setupNavigation() {
  window.addEventListener("load", () => {
    app = document.getElementById("app")!;
    if (!app) throw new Error("No #app container found");

    const page = history.state?.page || pathToPage(location.pathname) || "home";
    showView(page);
    if (!history.state) history.replaceState({ page }, "", pageToPath(page));
  });

  // Callback custom event déclenché après login Google réussi côté script oauth
  window.addEventListener("google-login-success", () => navigateTo("home"));

  // Navigation via boutons « back/forward » du navigateur
  window.addEventListener("popstate", (e) => showView(e.state?.page || "home"));
}

/******************************************************************
 *  Changer de page program­mati­quement
 ******************************************************************/
export function navigateTo(page: string) {
  history.pushState({ page }, "", pageToPath(page));
  showView(page);
}

/******************************************************************
 *  Router principal
 ******************************************************************/
function showView(view: string) {
  app.innerHTML = "";

  switch (view) {
    case "home":            return renderHomeView(app);
    case "login":           return renderLoginView(app);
    case "signup":          return renderSignupView(app);
    case "settings":        return renderSettingsView(app);
    case "game":            return renderGameView(app);
    case "user":            return renderUserView(app);

    // ─── 2FA setup / login ───
    case "setup-2fa":       return renderSetup2FAChoice(app);
    case "setup-2fa-qr":    return renderSetup2FAQr(app);
    case "login-2fa-code":  return renderLogin2FACode(app);

    default:                 return renderHomeView(app);
  }
}

/******************************************************************
 *  Helpers pour paths (si tu veux des URL clean)
 ******************************************************************/
function pageToPath(page: string): string {
  return page === "home" ? "/" : `/${page}`;
}

function pathToPage(pathname: string): string | null {
  const p = pathname.replace(/^\//, "");
  return p === "" ? "home" : p;
}