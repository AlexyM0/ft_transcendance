/******************************************************************
 * Match History view
 * Route: "matches"
 * - Charge l'utilisateur via /api/me
 * - Récupère ses matchs via /api/users/:id/matches
 ******************************************************************/

type MatchRow = {
  id: number;
  player1_id: number;
  player2_id: number;
  winner_id: number | null;
  player1_score: number;
  player2_score: number;
  match_type: string;
  match_date: string; // ISO
  duration: number;
  // joints
  player1_pseudo: string;
  player2_pseudo: string;
  winner_pseudo: string | null;
};

async function api<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("authToken");
  const r = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "API error");
  return data as T;
}

export async function renderMatchHistoryView(container: HTMLElement) {
  container.innerHTML = `
    <div class="w-full max-w-6xl mx-auto px-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">Match History</h2>
        <div id="matches-list" class="space-y-4">
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">Loading match history...</div>
        </div>
      </div>
    </div>
  `;

  const list = container.querySelector<HTMLDivElement>("#matches-list")!;
  try {
    // 1) Qui est connecté ?
    const me = await api<{ user: { sub: number; pseudo?: string } }>("/api/me");
    const myId = me.user.sub;

    // 2) Récup matches
    const res = await api<{ matches: MatchRow[] }>(`/api/users/${myId}/matches`);
    const matches = res.matches || [];

    if (!matches.length) {
      list.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">No matches played yet</div>';
      return;
    }

    list.innerHTML = matches.map((m) => {
      const isP1 = m.player1_id === myId;
      const myPseudo = isP1 ? m.player1_pseudo : m.player2_pseudo;
      const oppPseudo = isP1 ? m.player2_pseudo : m.player1_pseudo;
      const myScore = isP1 ? m.player1_score : m.player2_score;
      const oppScore = isP1 ? m.player2_score : m.player1_score;

      const isDraw = m.winner_id === null;
      const isWinner = m.winner_id === myId;

      const statusText = isDraw ? "Draw" : isWinner ? "Victory" : "Defeat";
      const statusClass = isDraw
        ? "text-yellow-600"
        : isWinner
        ? "text-green-600"
        : "text-red-600";

      const oppScoreClass = !isWinner && !isDraw ? "text-green-600" : isDraw ? "text-yellow-600" : "text-red-600";
      const myScoreClass = isWinner ? "text-green-600" : isDraw ? "text-yellow-600" : "text-red-600";

      return `
        <div class="bg-gray-50 dark:bg-gray-700 p-6 rounded-xl">
          <div class="flex justify-between items-center">
            <div class="flex items-center space-x-4">
              <div class="text-center">
                <div class="text-lg font-semibold text-gray-900 dark:text-white">${myPseudo}</div>
                <div class="text-2xl font-bold ${myScoreClass}">${myScore}</div>
              </div>
              <div class="text-gray-500 dark:text-gray-400">VS</div>
              <div class="text-center">
                <div class="text-lg font-semibold text-gray-900 dark:text-white">${oppPseudo}</div>
                <div class="text-2xl font-bold ${oppScoreClass}">${oppScore}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-semibold ${statusClass}">${statusText}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${new Date(m.match_date).toLocaleDateString()}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">${m.match_type || "1v1"}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (e: any) {
    console.error(e);
    list.innerHTML = `<div class="text-center py-8 text-red-500">Failed to load match history</div>`;
  }
}
