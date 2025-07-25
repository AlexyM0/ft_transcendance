import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type Database from "better-sqlite3";

declare module "fastify" {
  // Plugin fastify-sqlite
  interface FastifyInstance {
    sqlite: Database;
  }

  // Décorateur auth (pré-handler)
  interface FastifyInstance {
    auth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    optionalAuth?(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  // Types pour req.user (JWT payload)
  interface FastifyRequest {
    user?: {
      sub: number;
      email: string;
      pseudo: string;
      iat: number;
      exp: number;
    };
    isAuthenticated?: boolean;
  }
}