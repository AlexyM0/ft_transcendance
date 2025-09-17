// src/router/routes.ts
import { auth } from "../store/auth.store";
import type { View } from "../views/AppShell";
import { LoginView } from "../views/LoginView";
import { AppShell } from "../views/AppShell";
import { ProfileView } from "../views/ProfileView";
import { PlayChooserView } from "../views/PlayChooserView";
import { PlayLocalView } from "../views/PlayLocalView";
import { PlayOnlineView } from "../views/PlayOnlineView";
import { ChatsView } from "../views/ChatsView";
import { TournamentsView } from "../views/TournamentsView";
import { MatchLocalView } from "../views/MatchLocalView";
import { MatchOnlineView } from "../views/MatchOnlineView";

export type Route = {
  path: string;
  view: View;
  auth?: boolean;
};

export const Routes: Route[] = [
  { path: "/login", view: LoginView, auth: false },

  { path: "/play", view: AppShell(PlayChooserView), auth: true },
  { path: "/play/local", view: AppShell(PlayLocalView), auth: true },
  { path: "/play/local/m", view: AppShell(MatchLocalView), auth: true },
  { path: "/play/online", view: AppShell(PlayOnlineView), auth: true },
  { path: "/play/online/m", view: AppShell(MatchOnlineView), auth: true },

  { path: "/profile", view: AppShell(ProfileView), auth: true },
  { path: "/users/:pseudo", view: AppShell(ProfileView), auth: true },
  { path: "/chats", view: AppShell(ChatsView), auth: true },
  { path: "/tournaments", view: AppShell(TournamentsView), auth: true },
];

export async function guard({ route }: { route: Route }) {
  const s = auth.get();
  if (s.loading) return;
  if (route.auth && !s.meId) location.hash = "/login";
  if (!route.auth && route.path === "/login" && s.meId) location.hash = "/profile";
}
