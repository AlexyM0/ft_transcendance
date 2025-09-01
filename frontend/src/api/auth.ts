// src/api/auth.ts

/**
 * Mirrors auth routes. OAuth "start" endpoints are navigations, not XHR
 */

import { deleteRequest, postRequest } from "./http";

export const AuthAPI = {
  /**
   * POST /api/auth/register -> { id }
   */
  register: (email: string, pseudo: string, password: string) => {
    return postRequest<{ id: number }>("/api/auth/register", { email, pseudo, password });
  },

  /**
   * POST /api/auth/login -> { success: true } or { require2FA: true }
   */
  login: (pseudoOrEmail: string, password: string) => {
    return postRequest<{ success?: true; require2FA?: true }>("/api/auth/login", { pseudoOrEmail, password });
  },

  /**
   * POST /api/auth/logout -> { success: true }
   */
  logout: () => {
    return postRequest<{ success: true }>("/api/auth/logout");
  },

  /**
   * OAuth : Backend OAuth API (start functions) are browser navigations
   * because backend issues a 302 redirection
   */
  startGithubOAuth: () => {
    window.location.assign("/api/auth/oauth/github/start");
  },

  startGoogleOAuth: () => {
    window.location.assign("/api/auth/oauth/google/start");
  },

  start42OAuth: () => {
    window.location.assign("/api/auth/oauth/42/start");
  },

  /**
   * POST /api/auth/2fa/login -> { success: true }
   */
  verify2faLogin: (code: string) => {
    return postRequest<{ success: true }>("/api/auth/2fa/login", { code });
  },

  /**
   * POST /api/auth/2fa/setup -> { otpauth, qrDataUrl }
   */
  begin2fa: () => {
    return postRequest<{ otpauth: string; qrDataUrl: string }>("/api/auth/2fa/setup");
  },

  /**
   * POST /api/auth/2fa/verify -> { success: true }
   */
  verify2faSetup: (code: string) => {
    return postRequest<{ success: true }>("/api/auth/2fa/verify", { code });
  },

  /**
   * DELETE /api/auth/2fa -> { success: true }
   */
  disable2fa: () => {
    return deleteRequest<{ success: true }>("/api/auth/2fa");
  },
};
