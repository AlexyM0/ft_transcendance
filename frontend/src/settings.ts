// settings.ts

import { navigateTo } from "./navigation";

export function renderSettingsView(container: HTMLElement)
{
	container.innerHTML = `
		<div id="language-settings" class="flex flex-col items-center space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl">
			<div class="flex flex-col items-start space-y-4">
			<label class="flex items-center space-x-2 text-lg text-gray-900 dark:text-gray-100"><input type="radio" name="language" value="fr" checked class="accent-blue-600" /><span>Français</span></label>
			<label class="flex items-center space-x-2 text-lg text-gray-900 dark:text-gray-100"><input type="radio" name="language" value="en" class="accent-blue-600" /><span>Anglais</span></label>
			<label class="flex items-center space-x-2 text-lg text-gray-900 dark:text-gray-100"><input type="radio" name="language" value="zh" class="accent-blue-600" /><span>Chinois</span></label>
			</div>
	
			<button id="btn-back" class="mt-6 px-8 py-3 rounded-xl bg-gray-300 text-gray-900 font-medium text-lg hover:bg-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500 transition">
			Retour
			</button>
		</div>
		`;
	
	document.getElementById("btn-back")?.addEventListener("click", () => {
		navigateTo("home");
	});

}