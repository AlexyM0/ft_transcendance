
import { navigateTo } from "./navigation";
import { t } from "./i18n";

type User = {
  sub: string;
  pseudo: string;
  email: string;
  created_at?: string;
  avatar?: string | null;
};

type Stats = {
  games_played: number;
  wins: number;
  losses: number;
  win_ratio: number;
  total_score?: number;
  best_score?: number;
};

type ProfileResponse = { user: User; stats: Stats };

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

function fmtDate(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

export async function renderProfileView(root: HTMLElement) {
  root.innerHTML = `
<section class="w-full max-w-4xl mx-auto px-4">
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mt-6">
    <div class="flex justify-between items-center mb-8">
      <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Profil utilisateur</h2>
      <button id="btn-edit-profile" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
        Éditer le profil
      </button>
    </div>

    <div id="profile-display" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-1 flex flex-col items-center">
        <div class="relative">
          <img id="profile-avatar" src="/uploads/avatars/default-avatar.png" alt="Avatar"
               class="w-32 h-32 rounded-full object-cover border-4 border-gray-200 dark:border-gray-600 shadow-lg">
          <div id="avatar-overlay" class="hidden absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center cursor-pointer">
            <span class="text-white text-sm font-medium">Changer l'avatar</span>
          </div>
        </div>
        <div class="mt-4 flex space-x-2">
          <button id="btn-change-avatar" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">Changer</button>
          <button id="btn-remove-avatar" class="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition">Supprimer</button>
        </div>
        <input type="file" id="avatar-file-input" accept="image/*" class="hidden">
      </div>

      <div class="lg:col-span-1">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Infos</h3>
        <div class="space-y-3">
          <div><span class="font-medium text-gray-600 dark:text-gray-400">Pseudo:</span> <span id="profile-username" class="text-gray-900 dark:text-white"></span></div>
          <div><span class="font-medium text-gray-600 dark:text-gray-400">Email:</span> <span id="profile-email" class="text-gray-900 dark:text-white"></span></div>
          <div><span class="font-medium text-gray-600 dark:text-gray-400">Membre depuis:</span> <span id="profile-created" class="text-gray-900 dark:text-white"></span></div>
        </div>
      </div>

      <div class="lg:col-span-1">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Statistiques</h3>
        <div class="space-y-3">
          <div><span class="font-medium text-gray-600 dark:text-gray-400">Parties jouées:</span> <span id="profile-games" class="text-gray-900 dark:text-white"></span></div>
          <div><span class="font-medium text-gray-600 dark:text-gray-400">Victoires:</span> <span id="profile-wins" class="text-green-600 dark:text-green-400 font-semibold"></span></div>
          <div><span class="font-medium text-gray-600 dark:text-gray-400">Défaites:</span> <span id="profile-losses" class="text-red-600 dark:text-red-400 font-semibold"></span></div>
          <div><span class="font-medium text-gray-600 dark:text-gray-400">Win rate:</span> <span id="profile-winrate" class="text-purple-600 dark:text-purple-400 font-semibold"></span></div>
          <div><span class="font-medium text-gray-600 dark:text-gray-400">Score total:</span> <span id="profile-totalscore" class="text-gray-900 dark:text-white"></span></div>
          <div><span class="font-medium text-gray-600 dark:text-gray-400">Meilleur score:</span> <span id="profile-bestscore" class="text-orange-600 dark:text-orange-400 font-semibold"></span></div>
        </div>
      </div>
    </div>

    <!-- Édition -->
    <div id="profile-edit" class="hidden">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pseudo</label>
          <input type="text" id="edit-username" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
          <input type="email" id="edit-email" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
      </div>
      <div class="flex space-x-4 mt-8">
        <button id="btn-cancel-edit" class="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">Annuler</button>
        <button id="btn-save-profile" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">Sauvegarder</button>
      </div>
    </div>
  </div>
</section>
  `;

  // Charger user + stats
  try {
    const me = await apiCall<{ user: { sub: string } }>("/api/me");
    const data = await apiCall<ProfileResponse>(`/api/users/${me.user.sub}/profile`);
    fillProfile(root, data);
  } catch (e) {
    console.error(e);
  }

  // Interactions
  const avatar = root.querySelector<HTMLImageElement>("#profile-avatar")!;
  const overlay = root.querySelector<HTMLElement>("#avatar-overlay")!;
  avatar.addEventListener("mouseenter", () => overlay.classList.remove("hidden"));
  avatar.addEventListener("mouseleave", () => overlay.classList.add("hidden"));

  root.querySelector("#btn-edit-profile")?.addEventListener("click", () => {
    root.querySelector("#profile-display")?.classList.add("hidden");
    root.querySelector("#profile-edit")?.classList.remove("hidden");
    (root.querySelector("#btn-edit-profile") as HTMLElement).classList.add("hidden");

    // Pré-remplir
    (root.querySelector("#edit-username") as HTMLInputElement).value =
      (root.querySelector("#profile-username")?.textContent || "");
    (root.querySelector("#edit-email") as HTMLInputElement).value =
      (root.querySelector("#profile-email")?.textContent || "");
  });

  root.querySelector("#btn-cancel-edit")?.addEventListener("click", () => {
    root.querySelector("#profile-display")?.classList.remove("hidden");
    root.querySelector("#profile-edit")?.classList.add("hidden");
    (root.querySelector("#btn-edit-profile") as HTMLElement).classList.remove("hidden");
    (root.querySelector("#edit-username") as HTMLInputElement).value = "";
    (root.querySelector("#edit-email") as HTMLInputElement).value = "";
  });

  root.querySelector("#btn-save-profile")?.addEventListener("click", async () => {
    const name = (root.querySelector("#edit-username") as HTMLInputElement).value.trim();
    const email = (root.querySelector("#edit-email") as HTMLInputElement).value.trim();

    if (!name && !email) return alert("Fournis au moins un champ.");
    if (name && (name.length < 3 || name.length > 30 || !/^[A-Za-z0-9_-]+$/.test(name))) {
      return alert("Pseudo: 3–30 caractères, lettres/chiffres/_/-");
    }
    if (email && !/^[^@\s]+@[^@\s]+\\.[^@\\s]+$/i.test(email)) {
      return alert("Email invalide");
    }

    try {
      const body: Record<string, string> = {};
      if (name) body.pseudo = name;
      if (email) body.email = email;

      const resp = await apiCall<{ user: { pseudo: string; email: string } }>("/api/users/me", {
        method: "PUT",
        body: JSON.stringify(body),
      });

      alert("Profil mis à jour !");
      (root.querySelector("#profile-username") as HTMLElement).textContent = resp.user.pseudo;
      (root.querySelector("#profile-email") as HTMLElement).textContent = resp.user.email;

      root.querySelector("#btn-cancel-edit")?.dispatchEvent(new Event("click"));
    } catch (e: any) {
      alert(e.message || "Erreur de mise à jour");
    }
  });

  root.querySelector("#btn-change-avatar")?.addEventListener("click", () => {
    (root.querySelector("#avatar-file-input") as HTMLInputElement).click();
  });

  root.querySelector("#avatar-file-input")?.addEventListener("change", async (ev: Event) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Fichier image requis");
    if (file.size > 2 * 1024 * 1024) return alert("Max 2 Mo");

    const fd = new FormData();
    fd.append("avatar", file);
    try {
      await apiCall<{ avatarUrl: string }>("/api/users/me/avatar", { method: "POST", body: fd });
      (root.querySelector("#profile-avatar") as HTMLImageElement).src = URL.createObjectURL(file);
      alert("Avatar mis à jour !");
    } catch (e: any) {
      alert(e.message || "Échec upload avatar");
    }
  });

  root.querySelector("#btn-remove-avatar")?.addEventListener("click", async () => {
    if (!confirm("Supprimer l'avatar ?")) return;
    try {
      await apiCall<{}>("/api/users/me/avatar", { method: "DELETE" });
      (root.querySelector("#profile-avatar") as HTMLImageElement).src = "/uploads/avatars/default-avatar.png";
      alert("Avatar supprimé");
    } catch (e: any) {
      alert(e.message || "Échec suppression");
    }
  });
}

function fillProfile(root: HTMLElement, { user, stats }: ProfileResponse) {
  (root.querySelector("#profile-username") as HTMLElement).textContent = user.pseudo;
  (root.querySelector("#profile-email") as HTMLElement).textContent = user.email;
  (root.querySelector("#profile-created") as HTMLElement).textContent = fmtDate(user.created_at);

  (root.querySelector("#profile-games") as HTMLElement).textContent = String(stats.games_played ?? 0);
  (root.querySelector("#profile-wins") as HTMLElement).textContent = String(stats.wins ?? 0);
  (root.querySelector("#profile-losses") as HTMLElement).textContent = String(stats.losses ?? 0);
  (root.querySelector("#profile-winrate") as HTMLElement).textContent = `${Math.round((stats.win_ratio ?? 0) * 100)}%`;
  (root.querySelector("#profile-totalscore") as HTMLElement).textContent = String(stats.total_score ?? 0);
  (root.querySelector("#profile-bestscore") as HTMLElement).textContent = String(stats.best_score ?? 0);

  if (user.avatar) (root.querySelector("#profile-avatar") as HTMLImageElement).src = user.avatar;
}
