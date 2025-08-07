type Tournament = {
  id: string;
  name: string;
  description?: string;
  creator_pseudo: string;
  current_players: number;
  max_players: number;
  status: "pending" | "active" | "finished";
  created_at: string;
};
type TournamentsResponse = { tournaments: Tournament[] };

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

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]!));
}
function badgeClass(status: string) {
  if (status === "pending") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  if (status === "active")  return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
}

export async function renderTournamentsView(root: HTMLElement) {
  root.innerHTML = `
<section class="w-full max-w-6xl mx-auto px-4">
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mt-6">
    <div class="flex justify-between items-center mb-8">
      <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Tournois</h2>
      <button id="btn-create-tournament" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
        Créer un tournoi
      </button>
    </div>
    <div id="tournaments-list" class="space-y-4">
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">Chargement…</div>
    </div>
  </div>
</section>

<!-- Modal -->
<div id="create-tournament-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
    <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Créer un tournoi</h3>
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nom</label>
        <input type="text" id="tournament-name" placeholder="Nom du tournoi"
               class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description (optionnel)</label>
        <textarea id="tournament-description" rows="3" placeholder="Décris ton tournoi"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"></textarea>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max joueurs</label>
        <select id="tournament-max-players"
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
          <option value="4">4 joueurs</option>
          <option value="8" selected>8 joueurs</option>
          <option value="16">16 joueurs</option>
        </select>
      </div>
    </div>
    <div class="flex space-x-4 mt-8">
      <button id="btn-cancel-tournament" class="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">Annuler</button>
      <button id="btn-submit-tournament" class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">Créer</button>
    </div>
  </div>
</div>
  `;

  // Ouvrir/fermer modal
  const modal = root.querySelector("#create-tournament-modal") as HTMLElement;
  root.querySelector("#btn-create-tournament")?.addEventListener("click", () => modal.classList.remove("hidden"));
  root.querySelector("#btn-cancel-tournament")?.addEventListener("click", () => modal.classList.add("hidden"));

  // Soumission création
  root.querySelector("#btn-submit-tournament")?.addEventListener("click", async () => {
    const name = (root.querySelector("#tournament-name") as HTMLInputElement).value.trim();
    const description = (root.querySelector("#tournament-description") as HTMLTextAreaElement).value.trim();
    const maxPlayers = parseInt((root.querySelector("#tournament-max-players") as HTMLSelectElement).value, 10);

    if (!name) return alert("Le nom est requis");
    try {
      await apiCall("/api/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          max_players: maxPlayers,
        }),
      });
      modal.classList.add("hidden");
      (root.querySelector("#tournament-name") as HTMLInputElement).value = "";
      (root.querySelector("#tournament-description") as HTMLTextAreaElement).value = "";
      alert("Tournoi créé !");
      await loadTournaments(root);
    } catch (e: any) {
      alert(e.message || "Échec de création");
    }
  });

  await loadTournaments(root);
}

async function loadTournaments(root: HTMLElement) {
  try {
    const data = await apiCall<TournamentsResponse>("/api/tournaments");
    const list = root.querySelector("#tournaments-list") as HTMLElement;
    if (!data.tournaments || data.tournaments.length === 0) {
      list.innerHTML = `<div class="text-center py-8 text-gray-500 dark:text-gray-400">Aucun tournoi. Crée-en un !</div>`;
      return;
    }
    list.innerHTML = data.tournaments.map(t => `
<div class="bg-gray-50 dark:bg-gray-700 p-6 rounded-xl">
  <div class="flex justify-between items-start">
    <div>
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white">${escapeHtml(t.name)}</h3>
      <p class="text-gray-600 dark:text-gray-400 mt-2">${escapeHtml(t.description || "Aucune description")}</p>
      <div class="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mt-3">
        <span>Créé par: ${escapeHtml(t.creator_pseudo)}</span>
        <span>Joueurs: ${t.current_players}/${t.max_players}</span>
        <span>Statut: ${t.status}</span>
      </div>
    </div>
    <div class="text-right">
      <span class="inline-block px-3 py-1 text-xs font-semibold rounded-full ${badgeClass(t.status)}">${t.status}</span>
      <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">${fmtDate(t.created_at)}</div>
    </div>
  </div>
</div>
    `).join("");
  } catch (e) {
    console.error(e);
    (root.querySelector("#tournaments-list") as HTMLElement).innerHTML =
      `<div class="text-center py-8 text-red-500">Échec de chargement des tournois</div>`;
  }
}
