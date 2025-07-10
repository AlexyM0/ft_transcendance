// landing.ts
import { navigateTo } from "./navigation";

export function renderUserView(container: HTMLElement)
{
	container.innerHTML = `
		<div id="main-buttons" class="flex flex-col items-center space-y-10">
			<button id="btn-play"  class="relative px-12 py-5 rounded-2xl bg-purple-600 text-white text-xl font-semibold shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:bg-purple-700 active:translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-purple-300">
			Play
			</button>
		</div>
		`;

	document.getElementById("btn-play")?.addEventListener("click", () => navigateTo("game"));
}
