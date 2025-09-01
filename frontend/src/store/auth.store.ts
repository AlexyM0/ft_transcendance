// src/store/auth.ts
import { createStore } from "./createStore";
import { AuthAPI } from "../api/auth";
import { UsersAPI } from "../api/users";
import { HttpError } from "../api/http";
import { primeUser } from "./usersIndex.store";
import type { PublicUser } from "../api/types";

/**
 *
 */
export type AuthState = {
  meId: number | null;
  email: string | null;
  twofaEnabled: boolean;
  twofaRequired: boolean;
  loading: boolean;
  error: string | null;
};

export const auth = createStore<AuthState>({
  meId: null,
  email: null,
  twofaEnabled: false,
  twofaRequired: false,
  loading: true,
  error: null,
});

/**
 * Bootstrap session from cookie
 */
export async function bootstrapSession() {
  auth.set((s) => ({ ...s, loading: true, error: null }));
  try {
    const me = await UsersAPI.me();
    const publicMe: PublicUser = {
      id: me.id,
      pseudo: me.pseudo,
      avatar_url: me.avatar_url,
    };
    primeUser(publicMe);
    auth.set((s) => ({
      ...s,
      meId: me.id,
      email: me.email,
      twofaEnabled: me.is_2fa_enabled ? true : false,
      loading: false,
    }));
  } catch {
    auth.set((s) => ({ ...s, meId: null, email: null, twofaEnabled: false, loading: false }));
  }
}

/**
 * Register
 */
export async function register(email: string, pseudo: string, password: string) {
  return await AuthAPI.register(email, pseudo, password);
}

/**
 * Username/password login (may require 2FA)
 */
export async function login(pseudoOrEmail: string, password: string) {
  auth.set((s) => ({ ...s, error: null }));
  try {
    const res = await AuthAPI.login(pseudoOrEmail, password);
    if (res?.require2FA) {
      auth.set((s) => ({ ...s, twofaRequired: true }));
      return;
    }
    const me = await UsersAPI.me();
    const publicMe: PublicUser = {
      id: me.id,
      pseudo: me.pseudo,
      avatar_url: me.avatar_url,
    };
    primeUser(publicMe);
    auth.set((s) => ({
      ...s,
      meId: me.id,
      email: me.email,
      twofaEnabled: me.is_2fa_enabled ? true : false,
      loading: false,
    }));
  } catch (e: any) {
    const msg = e instanceof HttpError ? `${e.status}: ${e.message}` : "Login failed";
    auth.set((s) => ({ ...s, error: msg, meId: null, email: null, twofaEnabled: false, loading: false }));
    throw e;
  }
}

/**
 * Logout (ignore networks problems; clear local state regardless)
 */
export async function logout() {
  try {
    await AuthAPI.logout();
  } catch {}
  auth.set((s) => ({ ...s, meId: null, email: null, twofaRequired: false }));
  location.hash = "/login";
}

/**
 * Complete a pending 2FA login
 */
export async function verify2faLogin(code: string) {
  await AuthAPI.verify2faLogin(code);
  const me = await UsersAPI.me();
  const publicMe: PublicUser = {
    id: me.id,
    pseudo: me.pseudo,
    avatar_url: me.avatar_url,
  };
  primeUser(publicMe);
  auth.set((s) => ({
    ...s,
    meId: me.id,
    email: me.email,
    twofaEnabled: me.is_2fa_enabled ? true : false,
    loading: false,
  }));
}

/**
 * Begin 2FA enrollment (returns otpauth + QR) for UI to show
 */
export async function begin2fa() {
  return await AuthAPI.begin2fa();
}

/**
 * Verify 2FA setup code the user types
 */
export async function verify2faSetup(code: string) {
  await AuthAPI.verify2faSetup(code);
  auth.set((s) => ({ ...s, twofaEnabled: true }));
}

/**
 * Disable 2FA
 */
export async function disable2fa() {
  await AuthAPI.disable2fa();
  auth.set((s) => ({ ...s, twofaEnabled: false }));
}
