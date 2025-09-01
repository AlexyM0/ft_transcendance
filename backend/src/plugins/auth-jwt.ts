// auth-jwt.ts
/**
 * We want to build a plugin that :
 * - Parses cookies with @fastify/cookie
 * - Adds JWT support with @fastify/jwt
 * - Decorates helpers : issueSessionCookie, clearSessionCookie, authenticate
 * - Explains where hooks happen
 */

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";

const SESSION_COOKIE = "session";
const PENDING_COOKIE = "2fa_pending";
const isProd = process.env.NODE_ENV === "production";
const CROSS_SITE_COOKIES = (process.env.CROSS_SITE_COOKIES || "1") === "1";

/**
 * Create a token with jwtSign
 *
 * Set a cookie to the response :
 * - the name of the cookie is COOKIE_NAME ("session")
 * - value is the token (a string generated from payload)
 * - options are added to the token (http, duration, ...)
 */
const issueSessionCookie = async function (rep: FastifyReply, payload: Record<string, any>, options?: { expiresIn?: string | number }) {
  const token = await rep.jwtSign(payload, {
    expiresIn: options?.expiresIn ?? "1h",
  });
  console.log("Session cookie : ", token);
  rep.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd || CROSS_SITE_COOKIES,
    sameSite: CROSS_SITE_COOKIES ? ("none" as const) : ("strict" as const),
    path: "/",
    maxAge: 60 * 60,
  });
};

const issuePendingCookie = async function (rep: FastifyReply, payload: Record<string, any>, options?: { expiresIn?: string | number }) {
  const token = await rep.jwtSign(payload, {
    expiresIn: options?.expiresIn ?? "5m",
  });

  rep.setCookie(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: isProd || CROSS_SITE_COOKIES,
    sameSite: CROSS_SITE_COOKIES ? ("none" as const) : ("strict" as const),
    path: "/",
    maxAge: 5 * 60,
  });
};

/**
 * Delete the cookie from the response with clearCookie
 */
const clearSessionCookie = function (rep: FastifyReply) {
  rep.clearCookie(SESSION_COOKIE, { path: "/" });
};

const clearPendingCookie = function (rep: FastifyReply) {
  rep.clearCookie(PENDING_COOKIE, { path: "/" });
};

/**
 * The auth guard: a *preHandler* function. Not automatically executed.
 * You attach it via addHook('preHandler', fastify.authenticate) in a scope
 * or on specific routes.
 *
 * Under the hood, req.jwtVerify():
 *   - Reads the token (here: from the cookie)
 *   - Verifies signature/exp
 *   - On success, populates req.user (decoded payload)
 */
const authenticate = async function (req: FastifyRequest, rep: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return rep.code(401).send({ error: "Unauthorized" });
  }
};

const authenticatePending = async function (req: FastifyRequest, rep: FastifyReply) {
  try {
    const token = req.cookies?.[PENDING_COOKIE];
    if (!token) throw new Error("missing pending cookie");

    const decoded = await req.server.jwt.verify(token);
    (req as any).pendingUser = decoded;
  } catch {
    return rep.code(401).send({ error: "2FA pending verification required" });
  }
};

/**
 * Fastify auth plugin.
 * fastify.register(...) mounts third-party plugins *inside* our plugin scope.
 * Their effects (hooks, decorations) become available in this scope and below.
 *
 * fastify.decorate(name, value)
 * Adds an instance-level helper. After this, anywhere in this instance subtree
 * you can call fastify.issueSessionCookie(rep, payload).
 *
 * @ fastify/cookie:
 * - Parses the Cookie header early (onRequest) -> req.cookies
 * - Adds rep.setCookie / rep.clearCookie helpers
 *
 * @fastify/jwt:
 * - Adds rep.jwtSign(payload, opts)
 * - Adds req.jwtVerify(opts)
 *
 * Key takeaways :
 * - register(cookie) → creates onRequest parsing and rep.setCookie.
 * - register(jwt) → gives rep.jwtSign, req.jwtVerify (reads from cookie).
 * - decorate(...) → exposes your helpers on the instance.
 * - The guard is just a function—you decide where to attach it (per route or per scope).
 */
const authJwtPlugin = async function (fastify: FastifyInstance) {
  fastify.register(fastifyCookie, {
    hook: "onRequest",
  });

  fastify.register(fastifyJwt, {
    secret: "devsecret", //process.env.JWT_SECRET!,
    cookie: {
      cookieName: SESSION_COOKIE,
      signed: false,
    },
  });

  fastify.decorateRequest("pendingUser", null as any);
  fastify.decorate("issueSessionCookie", issueSessionCookie);
  fastify.decorate("issuePendingCookie", issuePendingCookie);

  fastify.decorate("clearSessionCookie", clearSessionCookie);
  fastify.decorate("clearPendingCookie", clearPendingCookie);

  fastify.decorate("authenticate", authenticate);
  fastify.decorate("authenticatePending", authenticatePending);
};

/**
 * fp(...) wraps our async function and tells Fastify:
 * - This is a plugin (has a name/version)
 * - Its decorations should be properly exposed to the instance that registered it
 * - We can declare dependencies (not shown here) if needed
 */
export default fp(authJwtPlugin, { name: "auth-jwt" });
