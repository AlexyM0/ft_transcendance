// src/router/routes.ts
import type { View } from "../views/AppShell";
import { LoginView } from "../views/LoginView";
import { AppShell } from "../views/AppShell";
import { HomeView } from "../views/HomeView";
import { ProfileView } from "../views/ProfileView";
import { FriendsView } from "../views/FriendsView";
import { ChatsView } from "../views/ChatsView";
import { TournamentsView } from "../views/TournamentsView";
import { auth } from "../store/auth";

export type Route = {
  path: string;
  view: View;
  auth?: boolean;
};

export const Routes: Route[] = [
  { path: "/login", view: LoginView, auth: false },
  { path: "/play", view: AppShell(HomeView), auth: true },
  { path: "/leaderboard", view: AppShell(HomeView), auth: true },
  { path: "/profile", view: AppShell(ProfileView), auth: true },
  { path: "/chats", view: AppShell(ChatsView), auth: true },
  { path: "/tournaments", view: AppShell(TournamentsView), auth: true },
];

export async function guard({ route }: { route: Route }) {
  const s = auth.get();
  if (s.loading) return;
  if (route.auth && !s.me) location.hash = "/login";
  if (!route.auth && route.path === "/login" && s.me) location.hash = "/profile";
}
