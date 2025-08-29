// user_stats.model.ts
import { db } from "../utils/db";
import { write } from "fs";

export type UserStatsRow = {
  user_id: number;
  wins: number;
  losses: number;
  games_played: number;
  win_ratio: number;
  total_score: number;
  best_score: number;
  updated_at: string;
};

/**
 * SQL commands
 */
const selectStats = db.prepare(`
	SELECT user_id, wins, losses, games_played, win_ratio, total_score, best_score, updated_at
	FROM user_stats WHERE user_id = ?
`);

const upsertNewUser = db.prepare(`
	INSERT INTO user_stats (user_id) VALUES (?)
	ON CONFLICT(user_id) DO NOTHING	
`);

const writeStats = db.prepare(`
	UPDATE user_stats
	SET wins = ?, losses = ?, games_played = ?, win_ratio = ?, total_score = ?, best_score = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
	WHERE user_id = ?
`);

/**
 * API
 */
export function getStats(userId: number): UserStatsRow | undefined {
  return selectStats.get(userId) as UserStatsRow | undefined;
}

export function applyMatchResultDelta(args: { winnerId: number; loserId: number; winnerScore: number; loserScore: number }) {
  const { winnerId, loserId, winnerScore, loserScore } = args;

  // Ensure rows exist
  upsertNewUser.run(winnerId);
  upsertNewUser.run(loserId);

  // Winner
  {
    const s = selectStats.get(winnerId) as UserStatsRow | undefined;
    const wins = (s?.wins ?? 0) + 1;
    const losses = s?.losses ?? 0;
    const games = wins + losses;
    const total = (s?.total_score ?? 0) + winnerScore;
    const best = Math.max(s?.best_score ?? 0, winnerScore);
    const ratio = games > 0 ? wins / games : 0;
    writeStats.run(wins, losses, games, ratio, total, best, winnerId);
  }

  // Loser
  {
    const s = selectStats.get(loserId) as UserStatsRow | undefined;
    const wins = s?.wins ?? 0;
    const losses = (s?.losses ?? 0) + 1;
    const games = wins + losses;
    const total = (s?.total_score ?? 0) + loserScore;
    const best = Math.max(s?.best_score ?? 0, loserScore);
    const ratio = games > 0 ? wins / games : 0;
    writeStats.run(wins, losses, games, ratio, total, best, loserId);
  }
}
