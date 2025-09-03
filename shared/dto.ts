// shared/dto.ts
/**
 * This file contains the contract types shared between frontend and backend
 * These types correspond to the Back-end responses and are consumed by the Front end
 */

export type Success = {
  success: boolean;
};

export type LoginResponse = {
  success?: boolean;
  require2FA?: boolean;
};

export type TwofaSetup = {
  otpauth: string;
  qrDataUrl: string;
};

export type UserId = {
  userId: number;
};

export type MeProfile = {
  userId: number;
  email: string;
  pseudo: string;
  avatarUrl: string | null;
  isTwofaEnabled: boolean;
};

export type MeProfileUpdated = {
  userId: number;
  email: string;
  pseudo: string;
  avatarUrl: string | null;
};

export type UserPublicProfile = {
  userId: number;
  email: string;
  pseudo: string;
  avatarUrl: string | null;
};

export type UserStats = {
  userId: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRatio: number;
  totalScore: number;
  bestScore: number;
  updatedAt: string;
};

export type MatchPlayer = {
  playerId: number;
  pseudo: string;
  avatarUrl: string | null;
};

export type MatchData = {
  matchId: number;
  player1Id: MatchPlayer;
  player2Id: MatchPlayer;
  status: "pending" | "finished" | "canceled";
  winnerId: number | null;
  scoreP1: number | null;
  scoreP2: number | null;
  createdAt: string;
};

export type MatchList = MatchData[];
