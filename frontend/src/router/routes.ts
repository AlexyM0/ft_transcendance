// src/router/routes.ts
import type { View } from "../views/AppShell";
import { LoginView } from "../views/LoginView";
import { AppShell } from "../views/AppShell";
import { ProfileView } from "../views/ProfileView";
import { ChatsView } from "../views/ChatsView";
import { TournamentsView } from "../views/TournamentsView";
import { auth } from "../store/auth.store";
import { PlayView } from "../views/PlayView";

export type Route = {
  path: string;
  view: View;
  auth?: boolean;
};

export const Routes: Route[] = [
  { path: "/login", view: LoginView, auth: false },
  { path: "/play", view: AppShell(PlayView), auth: true },
  { path: "/profile", view: AppShell(ProfileView), auth: true },
  { path: "/chats", view: AppShell(ChatsView), auth: true },
  { path: "/tournaments", view: AppShell(TournamentsView), auth: true },
];

export async function guard({ route }: { route: Route }) {
  const s = auth.get();
  if (s.loading) return;
  if (route.auth && !s.meId) location.hash = "/login";
  if (!route.auth && route.path === "/login" && s.meId) location.hash = "/profile";
}
