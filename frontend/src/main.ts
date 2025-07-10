/******************************************************************
 *  Application entry point – initializes navigation + Google OAuth
 ******************************************************************/

import { setupNavigation } from "./navigation";

// If you installed @types/google.accounts you can remove this line
declare const google: any;

/* ---------- Google Client ID ---------- */
const GOOGLE_CLIENT_ID =
  "215313879090-rshrl885bbbjmun6mcb1mmqao4vcl55g.apps.googleusercontent.com";

/* ---------- Start SPA navigation ---------- */
setupNavigation();

/* ---------- Initialise Google Identity Services ---------- */
window.addEventListener("DOMContentLoaded", () => {
  if (!(window as any).google?.accounts?.id) {
    console.error("Google SDK not loaded");
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback : handleGoogleCredential,
    ux_mode  : "popup"
  });
});

/* ---------- Callback executed after Google popup ---------- */
async function handleGoogleCredential(
  resp: google.accounts.id.CredentialResponse
): Promise<void> {
  const idToken = resp.credential;

  try {
    const r = await fetch("http://localhost:3000/api/login/google", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ id_token: idToken })
    });
    const data = await r.json();

    if (r.ok) {
      localStorage.setItem("authToken", data.token);
      // Inform navigation.ts that login is complete
      window.dispatchEvent(new CustomEvent("google-login-success"));
    } else {
      alert(data.error || "Google sign-in failed");
    }
  } catch (err) {
    console.error(err);
    alert("Network error");
  }
}
