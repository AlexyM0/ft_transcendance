// src/helpers/profileSelector.ts
import { auth } from "../store/auth.store";
import { usersIndex } from "../store/usersIndex.store";

export type ProfileInitial = {
  pseudo: string;
  email: string;
  avatarUrl: string | null;
} | null;

export function getProfileInitial(): ProfileInitial {
  const meId = auth.get().meId;
  if (!meId) return null;

  const me = usersIndex.get().byId[meId];
  return {
    pseudo: me?.pseudo ?? "",
    email: auth.get().email ?? "",
    avatarUrl: me?.avatar_url ?? null,
  };
}
