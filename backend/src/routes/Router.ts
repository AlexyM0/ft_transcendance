// Router.ts
/**
 * - User fetch http://localhost/api/register -> creates a user
 * - User fetch login -> gets a pending token or a directly a session token if 2FA is not activated
 * - User fetch confirms 2FA -> gets a session token
 * - User fetch all other pages -> api checks if the current token exists and is a session token
 */

import type { FastifyInstance } from "fastify";
import cors from "../plugins/cors";
import authJwt from "../plugins/auth-jwt";
import errorHandler from "../plugins/error-handler";
import oauthProviders from "../plugins/oauth-providers";

import { usersRoutes } from "../routes/user.routes";
import { authRoutesPublic, authRoutesPending, authRoutesPrivate } from "../routes/auth.routes";
import { chatRoutes } from "../routes/chat.routes";
import { friendsRoutes } from "../routes/friends.routes";
import { matchesRoutes } from "../routes/matches.route";
import { tournamentsRoutes } from "../routes/tournaments.routes";
import ws from "../plugins/ws_plugin";

export function setRouter(fastify: FastifyInstance) {
  // 1) Global plugins
  fastify.register(cors);
  fastify.register(authJwt);
  fastify.register(errorHandler);
  fastify.register(oauthProviders);

  // 2) Public routes
  fastify.register(authRoutesPublic, { prefix: "/api/auth" });

  // 3) Pending routes with guard
  fastify.register(async (pendingFastify: FastifyInstance) => {
    pendingFastify.addHook("preHandler", pendingFastify.authenticatePending);
    pendingFastify.register(authRoutesPending, { prefix: "/api/auth" });
  });

  // 4) Private routes with guard
  fastify.register(async (privateFastify: FastifyInstance) => {
    privateFastify.addHook("preHandler", privateFastify.authenticate);
    privateFastify.register(authRoutesPrivate, { prefix: "/api/auth" });
    privateFastify.register(usersRoutes, { prefix: "/api/users" });
    privateFastify.register(friendsRoutes, { prefix: "/api/friends" });
    privateFastify.register(chatRoutes, { prefix: "/api/chats" });
    privateFastify.register(matchesRoutes, { prefix: "/api/matches" });
    privateFastify.register(tournamentsRoutes, { prefix: "/api/tournaments" });
    privateFastify.register(ws);
  });
}
