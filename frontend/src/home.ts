// home.ts
import { navigateTo } from "./navigation";

export function renderHomeView(container: HTMLElement)
{
	container.innerHTML = `
		<div class="relative min-h-screen text-white bg-gradient-to-br from-black via-gray-900 to-gray-800 overflow-hidden">

			<!-- Top bar -->
			<div class="fixed top-0 left-0 right-0 z-10 backdrop-blur-lg bg-white/5 border-b border-white/10 h-16 flex items-center justify-between px-6">
				<div class="text-white text-lg font-light hidden sm:block">About</div>
				<div class="flex items-center gap-4 ml-auto">
					<!-- Language selector -->
					<select class="bg-transparent text-white border-none text-sm focus:outline-none">
						<option class="text-black">🇬🇧 EN</option>
						<option class="text-black">🇫🇷 FR</option>
						<option class="text-black">🇩🇪 DE</option>
					</select>

					<!-- Login button -->
					<button id="btn-login-1" class="px-5 text-white bg-amber-600 hover:bg-amber-700 rounded-full text-lg font-semibold shadow-lg transition-all">Login</button>
				</div>
			</div>

			
			<!-- Game title + buttons -->
			<div class="flex flex-col items-center justify-center text-center h-screen">
				<h1 class="text-7xl font-bangers text-white mb-10">TRANSCENDANCE</h1>
				<div class="flex flex-line gap-4">
					<button id="btn-login-2" class="px-8 py-3 bg-amber-600 hover:bg-amber-700 rounded-full text-lg font-semibold shadow-lg transition-all">
						Login
					</button>
					<button id="btn-guest" class="px-8 py-3 bg-gray-600 hover:bg-gray-700 rounded-full text-lg font-semibold shadow-lg transition-all">
						Guest Mode
					</button>
				</div>
			</div>
		</div>
		`;
	
	document.getElementById("btn-login-1")?.addEventListener("click", () => navigateTo("login"));

	document.getElementById("btn-login-2")?.addEventListener("click", () => navigateTo("login"));

	document.getElementById("btn-guest")?.addEventListener("click", () => navigateTo("user"));
}
