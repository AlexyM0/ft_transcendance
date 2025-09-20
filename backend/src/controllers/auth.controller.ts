// auth.controller.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import * as authService from "../services/auth.service";
import * as dto from "../types/dto";
import { err } from "../utils/errors";

export async function register(req: FastifyRequest, rep: FastifyReply) {
  const { email, pseudo, password } = req.body as any;
  if (!email || !pseudo || !password) throw err("USER_MISSING_FIELDS");
  await authService.register({ email, pseudo, password });
  return rep.code(201).send();
}

export async function login(req: FastifyRequest, rep: FastifyReply) {
  const { pseudoOrEmail, password } = req.body as any;
  if (!pseudoOrEmail || !password) throw err("USER_MISSING_FIELDS");

  const user = await authService.verifyCredentials(pseudoOrEmail, password);
  if (!user) throw err("INVALID_CREDENTIALS");

  let responseBody: dto.LoginResponse;

  if (user.is_2fa_enabled) {
    await req.server.issuePendingCookie(rep, { sub: user.id });
    responseBody = { require2FA: true };
    return rep.send(responseBody);
  }

  await req.server.issueSessionCookie(rep, {
    sub: user.id,
    pseudo: user.pseudo,
    email: user.email,
  });
  responseBody = { success: true };
  rep.send(responseBody);
}

export async function logout(req: FastifyRequest, rep: FastifyReply) {
  req.server.clearPendingCookie(rep);
  req.server.clearSessionCookie(rep);
  let responseBody: dto.LoginResponse = { success: true };
  return rep.send(responseBody);
}

// OAuth
// http://localhost:5000/api/auth/oauth/github/start
export async function githubOAuthStart(req: FastifyRequest, rep: FastifyReply) {
  const url = await req.server.githubOAuth2.generateAuthorizationUri(req, rep);
  return rep.code(302).redirect(url);
}

export async function githubOAuthCallback(
  req: FastifyRequest,
  rep: FastifyReply
) {
  const accessToken =
    await req.server.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(
      req,
      rep
    );
  const user = await authService.finishLoginFromGithub(
    accessToken.token.access_token
  );

  await req.server.issueSessionCookie(rep, {
    sub: user.id,
    pseudo: user.pseudoSuffix,
    email: user.email,
  });

  // const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol);
  // const host = String(req.headers["x-forwarded-host"] ?? req.headers["host"]);
  // const origin = `${proto}://${host}`;

  return rep.code(302).redirect(process.env.BASE_URL!);
}

export async function googleOAuthStart(req: FastifyRequest, rep: FastifyReply) {
  const url = await req.server.googleOAuth2.generateAuthorizationUri(req, rep);
  return rep.code(302).redirect(url);
}

export async function googleOAuthCallback(
  req: FastifyRequest,
  rep: FastifyReply
) {
  const accessToken =
    await req.server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
      req,
      rep
    );
  const user = await authService.finishLoginFromGoogle(
    accessToken.token.access_token
  );

  await req.server.issueSessionCookie(rep, {
    sub: user.id,
    pseudo: user.pseudoSuffix,
    email: user.email,
  });

  return rep.code(302).redirect(process.env.BASE_URL!);
}

export async function fortyTwoOAuthStart(
  req: FastifyRequest,
  rep: FastifyReply
) {
  const url = await req.server.fortyTwoOAuth2.generateAuthorizationUri(
    req,
    rep
  );
  return rep.code(302).redirect(url);
}

export async function fortyTwoOAuthCallback(
  req: FastifyRequest,
  rep: FastifyReply
) {
  const accessToken =
    await req.server.fortyTwoOAuth2.getAccessTokenFromAuthorizationCodeFlow(
      req,
      rep
    );
  const user = await authService.finishLoginFromFortyTwo(
    accessToken.token.access_token
  );

  await req.server.issueSessionCookie(rep, {
    sub: user.id,
    pseudo: user.pseudoSuffix,
    email: user.email,
  });

  return rep.code(302).redirect(process.env.BASE_URL!);
}

// 2FA code at setup (user already logged in, current token is session cookie)
export async function setup2FA(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);

  const { otpauth, qrDataUrl } = await authService.beginTwofaEnrollment(meId);
  let responseBody: dto.TwofaSetup = { otpauth: otpauth, qrDataUrl: qrDataUrl };
  return rep.send(responseBody);
}

export async function verify2FAsetupCode(
  req: FastifyRequest,
  rep: FastifyReply
) {
  const meId = Number((req.user as any).sub);
  const { code } = (req.body as any) ?? {};

  await authService.completeTwofaEnrollment(meId, code);
  let responseBody: dto.Success = { success: true };
  return rep.send(responseBody);
}

export async function disable2FA(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  authService.disableTwofa(meId);
  let responseBody: dto.Success = { success: true };
  return rep.send(responseBody);
}

// 2FA code at login (user pending login, current token is pending cookie)
export async function verify2FAloginCode(
  req: FastifyRequest,
  rep: FastifyReply
) {
  const pendingUser = (req as any).pendingUser as { sub?: number } | null;
  const userId = Number(pendingUser?.sub);
  if (!Number.isInteger(userId) || userId <= 0)
    throw err("TWOFA_SETUP_REQUIRED");

  const { code } = (req.body as any) ?? {};
  const user = await authService.verifyTwofaLoginCode(
    userId,
    String(code ?? "")
  );

  req.server.clearPendingCookie(rep);
  await req.server.issueSessionCookie(rep, {
    sub: userId,
    pseudo: user.pseudo,
    email: user.email,
  });

  let responseBody: dto.Success = { success: true };
  return rep.send(responseBody);
}
