/******************************************************************
 *  Sign-up view (classic credentials + Google OIDC)
 *  FIXES:
 *   - URLs relatives (/api/...) pour éviter CORS
 *   - Délégation d’événements pour fiabiliser le clic Register
 ******************************************************************/

import { navigateTo } from "./navigation";

/* ---------- regex identiques au back ---------- */
const USER_RE  = /^[A-Za-z0-9_-]{3,30}$/;
const MAIL_RE  = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
const PASS_RE  = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,128}$/;

/**
 * Rendu principal
 */
export function renderSignupView(container: HTMLElement): void {
  container.innerHTML = /* html */ `
    <div class="relative flex justify-center items-center min-h-screen text-white bg-gradient-to-br from-black via-gray-900 to-gray-800 overflow-hidden">
      <div id="signup-form" class="flex flex-col items-center space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <input id="input-pseudo"    type="text"     placeholder="Username"      class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white" />
        <input id="input-email"     type="email"    placeholder="Email address" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white" />
        <input id="input-password"  type="password" placeholder="Password"      class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white" />

        <!-- Google sign-up / sign-in -->
        <button id="btn-google" type="button"
                class="w-full px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition">
          Sign up with Google
        </button>

        <!-- Classic sign-up -->
        <button id="btn-valid-signup" type="button"
                class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
          Register
        </button>
      </div>
    </div>
  `;

  /* ---------- DÉLÉGATION D'ÉVÉNEMENTS (fiable même après rerender) ---------- */
  container.addEventListener(
    "click",
    (ev) => {
      const target = ev.target as HTMLElement;
      if (!target) return;

      // Register (classic)
      if (target.closest("#btn-valid-signup")) {
        ev.preventDefault();
        handleSignupButton();
        return;
      }

      // Google
      if (target.closest("#btn-google")) {
        ev.preventDefault();
        // Affiche la pop-in Google. La callback est handleGoogleSignup
        if (window.google?.accounts?.id) {
          window.google.accounts.id.prompt();
        } else {
          alert("Google SDK not loaded");
        }
        return;
      }
    },
    { capture: true }
  );

  // Initialisation Google OIDC (idempotent)
  try {
    window.google?.accounts?.id?.initialize?.({
      client_id:
        "215313879090-rshrl885bbbjmun6mcb1mmqao4vcl55g.apps.googleusercontent.com",
      callback: handleGoogleSignup,
    });
  } catch {
    /* pas bloquant */
  }
}

/*********************************************
 *  Google signup / login
 *********************************************/
async function handleGoogleSignup(
  resp: google.accounts.id.CredentialResponse
) {
  try {
    const r = await fetch("/api/login/google", {
      // ← URL RELATIVE (via Nginx)
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: resp.credential }),
    });
    const data = await r.json().catch(() => ({} as any));

    if (!r.ok) return alert(data.error || "Google auth error");

    if (data.challengeToken) {
      localStorage.setItem("challengeToken", data.challengeToken);
      navigateTo("login-2fa-code"); // écran de saisie du code 2FA
    } else if (data.sessionToken) {
      localStorage.setItem("authToken", data.sessionToken);
      navigateTo("dashboard"); // utilisateur connecté
    } else {
      alert("Réponse inattendue du serveur");
    }
  } catch (e) {
    console.error(e);
    alert("Network error");
  }
}

/*********************************************
 *  Classic credential sign-up
 *********************************************/
async function handleSignupButton(): Promise<void> {
  const pseudo   = (document.getElementById("input-pseudo")   as HTMLInputElement)?.value?.trim();
  const email    = (document.getElementById("input-email")    as HTMLInputElement)?.value?.trim();
  const password = (document.getElementById("input-password") as HTMLInputElement)?.value?.trim();

  if (!pseudo || !/^[A-Za-z0-9_-]{3,30}$/.test(pseudo))  { alert("Username: 3-30 letters, numbers, _ or -"); return; }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(email)) { alert("Invalid email address"); return; }
  if (!password || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,128}$/.test(password)) { alert("Password ≥6 chars with upper, lower and digit"); return; }

  const btn = document.querySelector<HTMLButtonElement>("#btn-valid-signup");
  btn && (btn.disabled = true, btn.textContent = "Registering…");

  try {
    const res  = await fetch("/api/register", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ pseudo, email, password })
    });

    const raw  = await res.text();        // ← on garde pour debug
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}

    // ⛔️ NE PAS CONTINUER si le JSON contient error OU si setupToken absent
    if (!res.ok || data?.error || !data?.setupToken) {
      console.warn("Signup failed:", { status: res.status, data });
      alert(data?.error || `Registration failed (status ${res.status})`);
      return; // ← IMPORTANT: on stoppe ici
    }

    // ✅ OK: on récupère le setupToken et on passe à la 2FA
    localStorage.setItem("setup2FAToken", data.setupToken);
    navigateTo("setup-2fa");

  } catch (err) {
    console.error(err);
    alert("Network error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Register"; }
  }
}


/* ---------- Types Google (si TS se plaint) ---------- */
/*
declare global {
  interface Window {
    google?: any;
  }
}
export {};
*/
