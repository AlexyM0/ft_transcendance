//-----------------------------------------------------------------
//  main.ts – SPA bootstrap + Google OIDC  (i18n ready)
//-----------------------------------------------------------------
import { setupNavigation, navigateTo } from "./navigation";
import { t } from "./i18n";


/* ---------- Clé Google ---------- */
const GOOGLE_CLIENT_ID =
  "215313879090-rshrl885bbbjmun6mcb1mmqao4vcl55g.apps.googleusercontent.com";

/* ---------- Navigation SPA ---------- */
setupNavigation();

/* ---------- Initialisation SDK Google ---------- */
window.addEventListener("DOMContentLoaded", async () => {
  if (!window.google?.accounts?.id) {
    console.error(await t("google.sdk_missing"));   // log technique, pas alert
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback : handleGoogleCredential,
    ux_mode  : "popup",
  });
});

/* ---------- Callback après le pop-up ---------- */
async function handleGoogleCredential(
  resp: google.accounts.id.CredentialResponse,
) {
  const idToken = resp.credential;

  try {
    const r = await fetch("http://localhost:3000/api/login/google", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ id_token: idToken }),
    });
    const data = await r.json();

    if (r.ok) {
      localStorage.setItem("authToken", data.sessionToken ?? data.token);

      // Informe le routeur que la connexion est terminée
      window.dispatchEvent(new CustomEvent("google-login-success"));

      navigateTo("home");

      alert(await t("google.success"));
    } else {
      alert(data.error || (await t("google.error")));
    }
  } catch {
    alert(await t("network_error"));
  }
}
