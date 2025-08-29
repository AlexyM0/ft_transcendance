// fastify.d.ts
import "fastify";
import type { FastifyReply, preHandlerHookHandler } from "fastify";
import { UserType } from "@fastify/jwt";

declare module "fastify" {
  interface FastifyRequest {
    pendingUser: UserType | null;
  }

  interface FastifyInstance {
    issueSessionCookie: (rep: FastifyReply, payload: Record<string, any>, options?: { expiresIn?: string | number }) => Promise<void>;
    issuePendingCookie: (rep: FastifyReply, payload: Record<string, any>, options?: { expiresIn?: string | number }) => Promise<void>;

    clearSessionCookie: (rep: FastifyReply) => void;
    db: Database.Database;
    dbModels: {
      user: UserModel;
    };
    clearPendingCookie: (rep: FastifyReply) => void;
    db: Database.Database;
    dbModels: {
      user: UserModel;
    };

    authenticate: preHandlerHookHandler;
    authenticatePending: preHandlerHookHandler;
    githubOAuth2: any;
    googleOAuth2: any;
    fortyTwoOAuth2: any;
  }
}
