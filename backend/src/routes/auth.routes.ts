// auth.routes.ts
import type { FastifyPluginAsync, FastifyInstance } from "fastify";
import * as authController from "../controllers/auth.controller";

export const authRoutesPublic: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  fastify.post("/register", authController.register); // create a new user
  fastify.post("/login", authController.login); // login
  fastify.post("/logout", authController.logout); // logout
  fastify.get("/oauth/github/start", authController.githubOAuthStart);
  fastify.get("/oauth/github/callback", authController.githubOAuthCallback);
  fastify.get("/oauth/google/start", authController.googleOAuthStart);
  fastify.get("/oauth/google/callback", authController.googleOAuthCallback);
  fastify.get("/oauth/42/start", authController.fortyTwoOAuthStart);
  fastify.get("/oauth/42/callback", authController.fortyTwoOAuthCallback);
};

export const authRoutesPending: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  // 2FA setup
  fastify.post("/2fa/login", authController.verify2FAloginCode); // verify 2FA code during login
};

export const authRoutesPrivate: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  fastify.post("/2fa/setup", authController.setup2FA); // generate + return QR code
  fastify.post("/2fa/verify", authController.verify2FAsetupCode); // verify user's 2FA setup code
  fastify.delete("/2fa", authController.disable2FA); // disable/remove 2FA
};
