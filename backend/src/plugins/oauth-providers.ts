// oauth-providers.ts
import fp from "fastify-plugin";
import oauthPlugin, { FastifyOAuth2Options } from "@fastify/oauth2";
import { FastifyInstance } from "fastify";

const reqEnv = function (name: string): string {
  const envVar = process.env[name];
  if (!envVar) throw new Error(`Missing env ${name}`);
  return envVar;
};

const githubOAuth2Options = function (): FastifyOAuth2Options {
  return {
    name: "githubOAuth2",
    credentials: {
      client: {
        id: reqEnv("GITHUB_CLIENT_ID"),
        secret: reqEnv("GITHUB_CLIENT_SECRET"),
      },
      auth: {
        authorizeHost: "https://github.com",
        authorizePath: "/login/oauth/authorize",
        tokenHost: "https://github.com",
        tokenPath: "/login/oauth/access_token",
      },
    },
    scope: ["read:user", "user:email"],
    callbackUri: `${reqEnv("BASE_URL")}/api/auth/oauth/github/callback`,
  };
};

const googleOAuth2Options = function (): FastifyOAuth2Options {
  return {
    name: "googleOAuth2",
    credentials: {
      client: {
        id: reqEnv("GOOGLE_CLIENT_ID"),
        secret: reqEnv("GOOGLE_CLIENT_SECRET"),
      },
      auth: {
        authorizeHost: "https://accounts.google.com",
        authorizePath: "/o/oauth2/v2/auth",
        tokenHost: "https://oauth2.googleapis.com",
        tokenPath: "/token",
      },
    },
    scope: ["openid", "email", "profile"],
    callbackUri: `${reqEnv("BASE_URL")}/api/auth/oauth/google/callback`,
  };
};

const fortyTwoOAuth2Options = function (): FastifyOAuth2Options {
  return {
    name: "fortyTwoOAuth2",
    credentials: {
      client: {
        id: reqEnv("FORTYTWO_CLIENT_ID"),
        secret: reqEnv("FORTYTWO_CLIENT_SECRET"),
      },
      auth: {
        authorizeHost: "https://api.intra.42.fr",
        authorizePath: "/oauth/authorize",
        tokenHost: "https://api.intra.42.fr",
        tokenPath: "/oauth/token",
      },
    },
    scope: ["public"],
    callbackUri: `${reqEnv("BASE_URL")}/api/auth/oauth/42/callback`,
  };
};

async function oauthProviders(fastify: FastifyInstance) {
  fastify.register(oauthPlugin, githubOAuth2Options);
  fastify.register(oauthPlugin, googleOAuth2Options);
  fastify.register(oauthPlugin, fortyTwoOAuth2Options);
}

export default fp(oauthProviders, { name: "oauth-providers" });
