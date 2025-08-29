// auth.controller.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import * as authService from "../services/auth.service";
import { err } from "../utils/errors";

export async function register(req: FastifyRequest, rep: FastifyReply) {
  const { email, pseudo, password } = req.body as any;
  if (!email || !pseudo || !password) throw err("USER_MISSING_FIELDS");
  const { id } = await authService.register({ email, pseudo, password });
  return rep.code(201).send({ id });
}

export async function login(req: FastifyRequest, rep: FastifyReply) {
  const { pseudoOrEmail, password } = req.body as any;
  if (!pseudoOrEmail || !password) throw err("USER_MISSING_FIELDS");

  const user = await authService.verifyCredentials(pseudoOrEmail, password);
  if (!user) throw err("INVALID_CREDENTIALS");

  if (user.is_2fa_enabled) {
    await req.server.issuePendingCookie(rep, { sub: user.id });
    return rep.send({ require2FA: true });
  }

  await req.server.issueSessionCookie(rep, { sub: user.id, pseudo: user.pseudo, email: user.email });
  rep.send({ success: true });
}

export async function logout(req: FastifyRequest, rep: FastifyReply) {
  req.server.clearPendingCookie(rep);
  req.server.clearSessionCookie(rep);
  return rep.send({ success: true });
}

// OAuth
// http://localhost:5000/api/auth/oauth/github/start
export async function githubOAuthStart(req: FastifyRequest, rep: FastifyReply) {
  const url = await req.server.githubOAuth2.generateAuthorizationUri(req, rep);
  return rep.code(302).redirect(url);
}

export async function githubOAuthCallback(req: FastifyRequest, rep: FastifyReply) {
  const accessToken = await req.server.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(req, rep);
  const user = await authService.finishLoginFromGithub(accessToken.token.access_token);

  await req.server.issueSessionCookie(rep, { sub: user.id, pseudo: user.pseudoSuffix, email: user.email });
  return rep.code(302).redirect("http://localhost:5173");
}

export async function googleOAuthStart(req: FastifyRequest, rep: FastifyReply) {
  const url = await req.server.googleOAuth2.generateAuthorizationUri(req, rep);
  return rep.code(302).redirect(url);
}

export async function googleOAuthCallback(req: FastifyRequest, rep: FastifyReply) {
  const accessToken = await req.server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req, rep);
  const user = await authService.finishLoginFromGoogle(accessToken.token.access_token);

  await req.server.issueSessionCookie(rep, { sub: user.id, pseudo: user.pseudoSuffix, email: user.email });
  return rep.code(302).redirect("http://localhost:5173");
}

export async function fortyTwoOAuthStart(req: FastifyRequest, rep: FastifyReply) {
  const url = await req.server.fortyTwoOAuth2.generateAuthorizationUri(req, rep);
  return rep.code(302).redirect(url);
}

export async function fortyTwoOAuthCallback(req: FastifyRequest, rep: FastifyReply) {
  const accessToken = await req.server.fortyTwoOAuth2.getAccessTokenFromAuthorizationCodeFlow(req, rep);
  const user = await authService.finishLoginFromFortyTwo(accessToken.token.access_token);

  await req.server.issueSessionCookie(rep, { sub: user.id, pseudo: user.pseudoSuffix, email: user.email });
  return rep.code(302).redirect("http://localhost:5173");
}

// 2FA code at setup (user already logged in, current token is session cookie)
export async function setup2FA(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);

  const { otpauth, qrDataUrl } = await authService.beginTwofaEnrollment(meId);
  return rep.send({ otpauth, qrDataUrl });
}

export async function verify2FAsetupCode(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const { code } = (req.body as any) ?? {};

  await authService.completeTwofaEnrollment(meId, code);
  return rep.send({ success: true });
}

export async function disable2FA(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  authService.disableTwofa(meId);
  return rep.send({ success: true });
}

// 2FA code at login (user pending login, current token is pending cookie)
export async function verify2FAloginCode(req: FastifyRequest, rep: FastifyReply) {
  const pendingUser = (req as any).pendingUser as { sub?: number } | null;
  const userId = Number(pendingUser?.sub);
  if (!Number.isInteger(userId) || userId <= 0) throw err("TWOFA_SETUP_REQUIRED");

  const { code } = (req.body as any) ?? {};
  const user = await authService.verifyTwofaLoginCode(userId, String(code ?? ""));

  req.server.clearPendingCookie(rep);
  await req.server.issueSessionCookie(rep, { sub: userId, pseudo: user.pseudo, email: user.email });

  return rep.send({ success: true });
}
