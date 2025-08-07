import { navigateTo } from "./navigation";
import { t } from "./i18n";
/**
 * Vue Dashboard
 * - Récupère l'utilisateur via /api/me
 * - Charge ses stats via /api/users/:sub/profile
 */

type Stats = {
  games_played: number;
  wins: number;
  losses: number;
  win_ratio: number; // 0..1
};

type ProfileResponse = {
  user: { sub: string; pseudo: string; email: string };
  stats: Stats;
};

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("authToken");
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  const res = await fetch(endpoint, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "API call failed");
  return data as T;
}

export async function renderDashboardView(root: HTMLElement) {
  root.innerHTML = `
<section class="w-full max-w-6xl mx-auto px-4">
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mt-6">
    <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">Dashboard</h2>

    <div id="stats-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      ${card("Total Games", "0", "blue")}
      ${card("Wins", "0", "green")}
      ${card("Losses", "0", "red")}
      ${card("Win Rate", "0%", "purple")}
    </div>

    <div class="flex flex-wrap gap-4">
      <button id="quick-profile" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Voir le profil</button>
      <button id="quick-tournaments" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">Parcourir les tournois</button>
      <button id="quick-create-tournament" class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">Créer un tournoi</button>
    </div>
  </div>
</section>
  `;

  // Actions rapides
  root.querySelector("#quick-profile")?.addEventListener("click", () => navigateTo("profile"));
  root.querySelector("#quick-tournaments")?.addEventListener("click", () => navigateTo("tournaments"));
  root.querySelector("#quick-create-tournament")?.addEventListener("click", () => navigateTo("tournaments"));

  // Charger les stats
  try {
    const me = await apiCall<{ user: { sub: string } }>("/api/me");
    const data = await apiCall<ProfileResponse>(`/api/users/${me.user.sub}/profile`);
    const s = data.stats;
    updateCard(root, 0, String(s.games_played ?? 0));
    updateCard(root, 1, String(s.wins ?? 0));
    updateCard(root, 2, String(s.losses ?? 0));
    updateCard(root, 3, `${Math.round((s.win_ratio ?? 0) * 100)}%`);
  } catch (e) {
    console.error(e);
    // Pas loggé / erreur API
  }
}

function card(title: string, value: string, color: "blue" | "green" | "red" | "purple") {
  const tone = {
    blue:   ["bg-blue-50 dark:bg-blue-900/20", "text-blue-600 dark:text-blue-400", "text-blue-900 dark:text-blue-100"],
    green:  ["bg-green-50 dark:bg-green-900/20","text-green-600 dark:text-green-400","text-green-900 dark:text-green-100"],
    red:    ["bg-red-50 dark:bg-red-900/20","text-red-600 dark:text-red-400","text-red-900 dark:text-red-100"],
    purple: ["bg-purple-50 dark:bg-purple-900/20","text-purple-600 dark:text-purple-400","text-purple-900 dark:text-purple-100"],
  }[color];
  return `
<div class="${tone[0]} p-6 rounded-xl">
  <h3 class="${tone[1]} text-sm font-semibold mb-2">${title}</h3>
  <p class="text-3xl font-bold ${tone[2]}">${value}</p>
</div>`;
}

function updateCard(root: HTMLElement, idx: number, value: string) {
  const cards = root.querySelectorAll("#stats-cards p.text-3xl");
  if (cards[idx]) cards[idx].textContent = value;
}
