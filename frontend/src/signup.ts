 // signup.ts

import { navigateTo } from "./navigation";

export function renderSignupView(container : HTMLElement)
{
	container.innerHTML = `
		<div class="relative flex justify-center items-center min-h-screen text-white bg-gradient-to-br from-black via-gray-900 to-gray-800 overflow-hidden">
			
			<div id="signup-form" class="flex flex-col items-center space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
				<input id="input-pseudo" type="text"     placeholder="Pseudo"          class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white" />
				<input id="input-email" type="email"    placeholder="Adresse mail"    class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white" />
				<input id="input-password" type="password" placeholder="Mot de passe"    class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white" />
			
				<button class="w-full px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition">
				Sign up with Google
				</button>
			
				<button id="btn-valid-signup" class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
				Valider l'inscription
				</button>
			</div>
		</div>
		`;

		document.getElementById("btn-valid-signup")?.addEventListener("click", async () => handleSignupButton());
}
 
async function handleSignupButton()
{
	const pseudo    = (document.getElementById("input-pseudo") as HTMLInputElement)?.value.trim();
	const email     = (document.getElementById("input-email") as HTMLInputElement)?.value.trim();
	const password  = (document.getElementById("input-password") as HTMLInputElement)?.value.trim();
	
	if (!pseudo || !email || !password) { alert("Tous les champs sont requis"); return; }
	
	try {
		const res  = await fetch("http://localhost:3000/api/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password })   // le backend ignore pseudo pour l'instant
		});
		const data = await res.json();
		
		if (res.ok) {
			alert("Inscription réussie !");
			navigateTo("login");
		} else {
			alert(data.error || "Erreur lors de l'inscription");
		}
	} catch (err) {
		console.error(err);
		alert("Erreur réseau");
	}
}