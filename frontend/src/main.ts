import { setupNavigation } from "./navigation";

/* ---------- Clé Google ---------- */
const GOOGLE_CLIENT_ID =
  "215313879090-rshrl885bbbjmun6mcb1mmqao4vcl55g.apps.googleusercontent.com";

/* ---------- Navigation SPA ---------- */
setupNavigation();

/* ---------- Initialisation SDK Google ---------- */
window.addEventListener("DOMContentLoaded", () => {
  if (!window.google?.accounts?.id) {
    console.error("SDK Google non chargé");
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback : handleGoogleCredential,
    ux_mode  : "popup"
  });
});

/* ---------- Callback après le pop-up ---------- */
async function handleGoogleCredential(resp: google.accounts.id.CredentialResponse) {
  const idToken = resp.credential;

  const r = await fetch("http://localhost:3000/api/login/google", {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ id_token: idToken })
  });
  const data = await r.json();

  if (r.ok) {
    localStorage.setItem("authToken", data.token);
    // >>> on informe navigation.ts que la connexion est terminée
    window.dispatchEvent(new CustomEvent("google-login-success"));
  } else {
    alert(data.error || "Connexion Google impossible");
  }
}
