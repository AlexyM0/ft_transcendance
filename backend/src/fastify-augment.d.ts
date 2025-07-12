import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";

declare module "fastify" {
  // Plugin fastify-sqlite
  interface FastifyInstance {
    sqlite: Database;
  }

  // Décorateur auth (pré-handler)
  interface FastifyInstance {
    auth(request: any, reply: any): Promise<void>;
  }
}