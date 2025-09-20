// src/api/types.ts
/**
 * Lightweight shapes matching the backend controllers' responses
 */

import type { MatchSettings } from "../helpers/GameTypes";

export type Me = {
  id: number;
  email: string;
  pseudo: string;
  is_2fa_enabled: 0 | 1;
  avatar_url: string | null;
};

export type PublicUser = {
  id: number;
  pseudo: string;
  avatar_url: string | null;
};

export type UserStats = {
  user_id: number;
  wins: number;
  losses: number;
  games_played: number;
  win_ratio: number;
  total_score: number;
  best_score: number;
};

export type FriendRequest = {
  id: number;
  from_user_id: number;
  to_user_id: number;
  created_at: string;
};

export type ChatPeer = PublicUser;

export type ChatListItem = {
  id: number;
  created_at: string;
  peer: ChatPeer;
  last_message: null | {
    id: number;
    author_id: number;
    body: string;
    created_at: string;
  };
};

export type Message = {
  id: number;
  chat_id: number;
  author_id: number;
  body: string;
  created_at: string;
};

export type Match = {
  id: number;
  player1_id: number;
  player2_id: number;
  status: "pending" | "completed" | "canceled";
  winner_id: number | null;
  score_P1: number | null;
  score_P2: number | null;
  created_at: string;
};

export type UserMatches = {
  userId: number;
  matches: Match[];
  limit: number;
  offset: number;
};

export type TournamentStatus =
  | "registration"
  | "ongoing"
  | "finished"
  | "canceled";

export type TournamentLite = {
  tournament_id: number;
  title: string;
  created_by: PublicUser;
  max_players: number;
  player_count: number;
  status: TournamentStatus;
  created_at: string;
};

export type TournamentPlayerSlot = {
  user_id: number;
  name: string;
  alias: string | null;
  avatar_url: string | null;
};

export type TournamentMatch = {
  tournament_id: number;
  match_id: number;
  player1_idx: number;
  player2_idx: number;
  played: boolean;
  score_p1: number | null;
  score_p2: number | null;
};

export type TournamentFull = {
  tournament_id: number;
  title: string;
  owner: PublicUser;
  max_players: number;
  status: TournamentStatus;
  settings: MatchSettings;
  players: TournamentPlayerSlot[];
  matches: TournamentMatch[];
};

export type CreateTournamentPayload = {
  name: string;
  maxPlayers: number;
  settings: MatchSettings;
};

export type UpdateAliasPayload = {
  index: number;
  alias: string;
};
