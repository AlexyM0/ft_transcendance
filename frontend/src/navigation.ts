/******************************************************************
 *  Simple SPA router (history API)
 *  + vues 2FA
 *  + App Shell pour pages authentifiées (dashboard/profile/tournaments/matches)
 ******************************************************************/

import { renderHomeView       } from "./home.ts";
import { renderLoginView      } from "./login.ts";
import { renderSignupView     } from "./signup.ts";
import { renderSettingsView   } from "./settings.ts";
import { renderUserView       } from "./userview.ts";
import { renderGameView       } from "./game.ts";

// Nouvelles vues
import { renderDashboardView    } from "./dashboard.ts";
import { renderProfileView      } from "./profile.ts";
import { renderTournamentsView  } from "./tournaments.ts";
import { renderMatchHistoryView } from "./matches.ts";

// 2FA related views
import {
  renderSetup2FAChoice,
  renderSetup2FAQr,
  renderLogin2FACode,
} from "./2faViews.ts";

let app: HTMLElement;

// Pages qui utilisent le Shell (navbar + gradient)
const AUTH_PAGES = new Set(["dashboard", "profile", "tournaments", "matches"] as const);
type AuthPage = "dashboard" | "profile" | "tournaments" | "matches";

/******************************************************************
 *  Initialisation
 ******************************************************************/
export function setupNavigation() {
  window.addEventListener("load", () => {
    app = document.getElementById("app")!;
    if (!app) throw new Error("No #app container found");

    const page = (history.state?.page as string) || pathToPage(location.pathname) || "home";
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
  // Pages authentifiées : on rend dans le Shell
  if (AUTH_PAGES.has(view as AuthPage)) {
    const token = localStorage.getItem("authToken");
    if (!token) {
      // Pas de token → on renvoie vers le login
      return navigateTo("login");
    }

    // Monte (ou remonte) le shell et récupère la zone de rendu interne
    const root = mountAuthShell(app);
    setActiveNav(view);

    // Rendre la vue ciblée dans la zone du shell
    switch (view as AuthPage) {
      case "dashboard":   return renderDashboardView(root);
      case "profile":     return renderProfileView(root);
      case "tournaments": return renderTournamentsView(root);
      case "matches":     return renderMatchHistoryView(root);
    }
    return;
  }

  // Pages publiques (pas de Shell)
  unmountAuthShell(app);
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

    default:                return renderHomeView(app);
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

/******************************************************************
 *  ───────────────  App Shell (navbar + fond sombre)  ───────────────
 *  Pas de dépendance externe : markup + listeners à chaque rendu
 ******************************************************************/

let shellMounted = false;

function mountAuthShell(host: HTMLElement): HTMLElement {
  host.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <!-- NAV -->
      <nav class="fixed top-0 left-0 right-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur shadow z-50 border-b border-black/5 dark:border-white/10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div class="flex items-center gap-8">
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">ft_transcendance</h1>
            <div class="hidden md:flex gap-2">
              <button data-nav="dashboard"   class="nav-link px-3 py-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Dashboard</button>
              <button data-nav="profile"     class="nav-link px-3 py-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Profile</button>
              <button data-nav="tournaments" class="nav-link px-3 py-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Tournaments</button>
              <button data-nav="matches"     class="nav-link px-3 py-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Match History</button>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <span id="shell-welcome" class="text-gray-600 dark:text-gray-300 text-sm"></span>
            <button id="shell-logout" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium">Logout</button>
          </div>
        </div>
      </nav>

      <!-- CONTENU -->
      <section style="padding-top:80px">
        <div id="auth-view-root" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"></div>
      </section>
    </div>
  `;

  // Listeners de la barre (délégation)
  const shell = host.firstElementChild as HTMLElement;
  shell.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (!t) return;

    const navBtn = t.closest("[data-nav]") as HTMLElement | null;
    if (navBtn) {
      const page = navBtn.getAttribute("data-nav")!;
      if (AUTH_PAGES.has(page as AuthPage)) {
        setActiveNav(page);
        navigateTo(page);
      }
      return;
    }

    if (t.closest("#shell-logout")) {
      localStorage.removeItem("authToken");
      navigateTo("home");
      return;
    }
  }, { capture: true });

  // Met à jour le "Welcome, pseudo" si /api/me existe
  updateWelcome(shell).catch(() => { /* silencieux */ });

  shellMounted = true;
  const root = shell.querySelector("#auth-view-root") as HTMLElement;
  if (!root) throw new Error("Shell root missing");
  return root;
}

function unmountAuthShell(host: HTMLElement) {
  if (!shellMounted) return;
  host.innerHTML = "";
  shellMounted = false;
}

function setActiveNav(page: string) {
  const links = document.querySelectorAll<HTMLButtonElement>(".nav-link");
  links.forEach((el) => {
    el.classList.remove("text-blue-600", "dark:text-blue-400", "font-semibold");
  });
  const active = document.querySelector<HTMLButtonElement>(`.nav-link[data-nav="${page}"]`);
  if (active) {
    active.classList.add("text-blue-600", "dark:text-blue-400", "font-semibold");
  }
}

async function updateWelcome(shell: HTMLElement) {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const r = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json().catch(() => ({} as any));
    const pseudo = d?.user?.pseudo ?? d?.pseudo ?? "";
    const el = shell.querySelector("#shell-welcome");
    if (el) el.textContent = pseudo ? `Welcome, ${pseudo}!` : "";
  } catch {
    // ignore
  }
}
