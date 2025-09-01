// /src/store/editProfile.store.ts

/**
 * No specific store in this file.
 * We just centralize the update of auth store and usersIndex store when profile is updated
 */

import { UsersAPI } from "../api/users";
import { auth } from "./auth.store";
import { usersIndex, primeUser } from "./usersIndex.store";
import type { Me, PublicUser } from "../api/types";

export type ProfileInput = {
  email?: string;
  pseudo?: string;
  avatarFile?: File | null;
};

export async function saveMyProfile(input: ProfileInput): Promise<Me> {
  const meId = auth.get().meId;
  if (!meId) throw new Error("Not authenticated");

  let latest: Me | null = null;

  const currentEmail = auth.get().email;
  const currentPublic = usersIndex.get().byId[meId as number];
  const currentPseudo = currentPublic?.pseudo;

  try {
    if (input.avatarFile) {
      latest = await UsersAPI.uploadAvatar(input.avatarFile);
    }

    const diff: Record<string, any> = {};
    if (input.email !== undefined && input.email !== currentEmail) diff.email = input.email;
    if (input.pseudo !== undefined && input.pseudo !== currentPseudo) diff.pseudo = input.pseudo;

    if (Object.keys(diff).length > 0) {
      latest = await UsersAPI.updateMe(diff);
    }

    if (!latest) {
      latest = await UsersAPI.me();
    }

    primeUser({ id: latest.id, pseudo: latest.pseudo, avatar_url: latest.avatar_url });
    auth.set((s) => ({ ...s, email: latest!.email }));
    return latest!;
  } catch (e) {
    throw e;
  }
}

/**
 * Deleting avatar
 */
export async function deleteAvatar() {
  const meId = auth.get().meId;
  if (!meId) throw new Error("Not authenticated");

  usersIndex.set((st) => ({
    ...st,
    updating: { ...st.updating, [meId]: true },
  }));
  try {
    const me: Me = await UsersAPI.deleteAvatar();
    const publicMe: PublicUser = {
      ...me,
      avatar_url: me.avatar_url,
    };
    primeUser(publicMe);
    usersIndex.set((st) => ({
      ...st,
      updating: { ...st.updating, [meId]: false },
    }));
  } finally {
    usersIndex.set((st) => ({
      ...st,
      updating: { ...st.updating, [meId]: false },
    }));
  }
}
