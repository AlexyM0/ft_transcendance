// login.ts

import { navigateTo } from "./navigation";

export function renderLoginView(container: HTMLElement)
{
	container.innerHTML = `
		<div class="relative flex justify-center items-center min-h-screen text-white bg-gradient-to-br from-black via-gray-900 to-gray-800 overflow-hidden">
			<div id="login-options" class="flex flex-col text-center space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
				<input id="input-email" type="email"     placeholder="Adresse mail" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white" />
				<input id="input-password" type="password"  placeholder="Mot de passe" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white" />

				<button class="w-full px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition">
				Sign in with Google
				</button>

				<button id="btn-signin" class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
				Se connecter
				</button>

				<button id="btn-to-signup" class="w-full text-sm text-blue-600 hover:underline dark:text-blue-400">
				Créer un compte
				</button>
			</div>
		</div>	
		`;

		document.getElementById("btn-signin")?.addEventListener("click", async () => handleSigninButton());
		document.getElementById("btn-to-signup")?.addEventListener("click", () => navigateTo("signup"));
}


async function	handleSigninButton()
{
	const email     = (document.getElementById("input-email") as HTMLInputElement)?.value.trim();
	const password  = (document.getElementById("input-password") as HTMLInputElement)?.value.trim();
	
	if (!email || !password) { alert("Email et mot de passe requis"); return; }
	
	try {
		const res  = await fetch("http://localhost:3000/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password })
		});
		const data = await res.json();
		
		if (res.ok) {
			localStorage.setItem("authToken", data.token);
			alert("Connexion réussie !");
			navigateTo("home");
			// ici tu peux appeler /api/me pour afficher le profil
		} else {
			alert(data.error || "Erreur de connexion");
		}
	} catch (err) {
		console.error(err);
		alert("Erreur réseau");
	}
}