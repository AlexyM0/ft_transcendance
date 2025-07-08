// home.ts
import { navigateTo } from "./navigation";

export function renderHomeView(container: HTMLElement)
{
	container.innerHTML = `
		<div id="main-buttons" class="flex flex-col items-center space-y-10">
			<button id="btn-login"  class="relative px-12 py-5 rounded-2xl bg-blue-600 text-white text-xl font-semibold shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:bg-blue-700 active:translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-300">
			Login
			</button>

			<button id="btn-settings" class="relative px-12 py-5 rounded-2xl bg-gray-200 text-gray-900 text-xl font-semibold shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:bg-gray-300 active:translate-y-0.5 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-4 focus:ring-gray-400/60 dark:focus:ring-gray-500/60">
			Settings
			</button>

			<button id="btn-play"  class="relative px-12 py-5 rounded-2xl bg-purple-600 text-white text-xl font-semibold shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:bg-purple-700 active:translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-purple-300">
			Play
			</button>
		</div>
		`;
	
	document.getElementById("btn-login")?.addEventListener("click", () => navigateTo("login"));

	document.getElementById("btn-settings")?.addEventListener("click", () => navigateTo("settings"));

	document.getElementById("btn-play")?.addEventListener("click", () => navigateTo("game"));
}
