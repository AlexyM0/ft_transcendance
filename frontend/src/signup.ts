/******************************************************************
 *  Sign‑up view (classic credentials + Google OIDC)
 ******************************************************************/

import { navigateTo } from "./navigation";

// @types/google.accounts facultatif
/* global google */

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

        <!-- Google sign‑up / sign‑in -->
        <button id="btn-google" type="button"
                class="w-full px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition">
          Sign up with Google
        </button>

        <!-- Classic sign‑up -->
        <button id="btn-valid-signup"
                class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
          Register
        </button>
      </div>
    </div>
  `;

  /* ---------- listeners ---------- */
  document.getElementById("btn-valid-signup")?.addEventListener("click", handleSignupButton);

  document.getElementById("btn-google")?.addEventListener("click", () => {
    // Affiche la pop‑in Google. La callback est handleGoogleSignup
    google?.accounts?.id && google.accounts.id.prompt();
  });

  // Initialisation Google OIDC (une seule fois suffit)
  google?.accounts?.id?.initialize?.({
    client_id : "215313879090-rshrl885bbbjmun6mcb1mmqao4vcl55g.apps.googleusercontent.com", // .env côté front possible
    callback  : handleGoogleSignup,
  });
}

/*********************************************
 *  Google signup / login
 *********************************************/
async function handleGoogleSignup(resp: google.accounts.id.CredentialResponse) {
  try {
    const r  = await fetch("http://localhost:3000/api/login/google", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ id_token: resp.credential }),
    });
    const data = await r.json();

    if (!r.ok) return alert(data.error || "Google auth error");

    if (data.challengeToken) {
      localStorage.setItem("challengeToken", data.challengeToken);
      navigateTo("login-2fa-code");            // écran de saisie du code 2FA
    } else if (data.sessionToken) {
      localStorage.setItem("authToken", data.sessionToken);
      navigateTo("dashboard");                 // utilisateur connecté
    } else {
      alert("Réponse inattendue du serveur");
    }
  } catch (e) {
    console.error(e);
    alert("Network error");
  }
}

/*********************************************
 *  Classic credential sign‑up
 *********************************************/
async function handleSignupButton(): Promise<void> {
  const pseudo   = (document.getElementById("input-pseudo")   as HTMLInputElement).value.trim();
  const email    = (document.getElementById("input-email")    as HTMLInputElement).value.trim();
  const password = (document.getElementById("input-password") as HTMLInputElement).value.trim();

  /* ----- validation côté front ----- */
  if (!USER_RE.test(pseudo))  return alert("Username: 3-30 letters, numbers, _ or -");
  if (!MAIL_RE.test(email))   return alert("Invalid email address");
  if (!PASS_RE.test(password))return alert("Password ≥6 chars with upper, lower and digit");

  /* ----- appel API ----- */
  try {
    const res  = await fetch("http://localhost:3000/api/register", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ pseudo, email, password })
    });
    const data = await res.json();

    if (!res.ok) return alert(data.error || "Registration error");

    // Le back renvoie { setupToken: "..." }
    localStorage.setItem("setup2FAToken", data.setupToken);
    navigateTo("setup-2fa");            // écran choix « configurer / plus tard »
  } catch (err) {
    console.error(err);
    alert("Network error");
  }
}
