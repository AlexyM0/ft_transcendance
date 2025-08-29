// src/store/auth.ts
import { createStore } from "./createStore";
import { AuthAPI } from "../api/auth";
import { UsersAPI } from "./../api/users";
import type { Me } from "../api/types";
import { HttpError } from "../api/http";

/**
 *
 */
export type AuthState = {
  me: Me | null;
  loading: boolean;
  twofaRequired: boolean;
  error: string | null;
};

export const auth = createStore<AuthState>({
  me: null,
  loading: true,
  twofaRequired: false,
  error: null,
});

/**
 * Bootstrap session from cookie
 */
export async function bootstrapSession() {
  auth.set((s) => ({ ...s, loading: true, error: null }));
  try {
    const me = await UsersAPI.me();
    auth.set((s) => ({ ...s, me: me, loading: false }));
  } catch {
    auth.set((s) => ({ ...s, me: null, loading: false }));
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
    auth.set((s) => ({ ...s, me: { ...me, avatar_url: me.avatar_url ?? "/user.png" }, twofaRequired: false }));
  } catch (e: any) {
    const msg = e instanceof HttpError ? `${e.status}: ${e.message}` : "Login failed";
    auth.set((s) => ({ ...s, error: msg, me: null, twofaRequired: false }));
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
  auth.set((s) => ({ ...s, me: null, twofaRequired: false }));
  location.hash = "/login";
}

/**
 * Complete a pending 2FA login
 */
export async function verify2faLogin(code: string) {
  await AuthAPI.verify2faLogin(code);
  const me = await UsersAPI.me();
  auth.set((s) => ({ ...s, me, twofaRequired: false }));
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
}

/**
 * Disable 2FA
 */
export async function disable2fa() {
  await AuthAPI.disable2fa();
}
