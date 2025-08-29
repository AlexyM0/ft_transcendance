// src/api/types.ts
/**
 * Lightweight shapes matching the backend controllers' responses
 */

export type Me = {
  id: number;
  email: string;
  pseudo: string;
  avatar_url: string | null;
};

export type PublicUser = {
  id: number;
  pseudo: string;
  avatar_url: string | null;
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

export type Tournament = {
  id: number;
  owner_id: number;
  title: string;
  description: string | null;
  max_players: number;
  status: "registration" | "running" | "completed";
  created_at: string;
};

export type TournamentDetails = {
  tournament: Tournament;
  participants: { user_Id: number }[];
};
