// auth.service.ts
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import * as authModel from "../models/auth.model";
import { err } from "../utils/errors";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { decryptGCM, encryptGCM } from "../utils/crypto";
import { withTx } from "../utils/db";

const PSEUDO_MIN = 1;
const PSEUDO_MAX = 32;
const BCRYPT_HASH_ROUNDS = 12;

export async function register(input: { email: string; pseudo: string; password: string }): Promise<{ id: number }> {
  // Normalize
  const email = input.email.trim();
  const pseudo = input.pseudo.trim();

  if (pseudo.length < PSEUDO_MIN || pseudo.length > PSEUDO_MAX) throw err("BAD_PSEUDO");

  const hash = await bcrypt.hash(input.password, BCRYPT_HASH_ROUNDS);
  try {
    const { id } = authModel.createUser(email, pseudo, hash);
    if (!id) throw err("USER_ALREADY_EXISTS");
    return { id };
  } catch (e: any) {
    throw err("USER_ALREADY_EXISTS");
  }
}

export async function verifyCredentials(pseudoOrEmail: string, password: string) {
  const user = authModel.getByLogin(pseudoOrEmail);
  if (!user) return null;
  const password_ok = await bcrypt.compare(password, user.pwd_hash);
  if (!password_ok) return null;
  return {
    id: user.id,
    email: user.email,
    pseudo: user.pseudo,
    is_2fa_enabled: !!user.is_2fa_enabled,
  };
}

async function findOrCreateOAuthUser(email: string, preferredPseudo: string) {
  const user = authModel.getByLogin(email);
  if (user) return { id: user.id, email: user.email, pseudo: user.pseudo };

  const randomPassword = crypto.randomBytes(24).toString("hex");
  const pwdHash = await bcrypt.hash(randomPassword, BCRYPT_HASH_ROUNDS);
  const pseudo = (preferredPseudo ?? email.split("@")[0]).replace(/[^a-z0-9_]/gi, "").slice(0, 24);
  const pseudoSuffix = `${pseudo}_${crypto.randomBytes(4).toString("hex")}`;
  const { id } = authModel.createUser(email, pseudoSuffix, pwdHash);
  return { id, email, pseudoSuffix };
}

async function loadGithubIdentity(accessToken: string) {
  const identity = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "transcendance",
    },
    // signal: AbortSignal.timeout(8000),
  }).then((r) => r.json());
  //   if (!identity.ok) throw err("INVALID_CREDENTIALS", `Github /user failed: ${identity.status}`);

  let email: string | null = identity.email;
  if (!email) {
    const emails = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "transcendance",
      },
    }).then((r) => r.json());
    // if (!emails.ok) throw err("INVALID_CREDENTIALS", `Github /user failed: ${emails.status}`);

    const primaryEmail = Array.isArray(emails) ? emails.find((e: any) => e.primary && e.verified) : null;
    email = primaryEmail?.email || (Array.isArray(emails) ? emails.find((e: any) => e.verified)?.email : null);
  }
  if (!email) throw err("OAUTH_EMAIL_REQUIRED");
  return { email, preferredPseudo: identity.login || email.split("@")[0] };
}

async function loadGoogleIdentity(accessToken: string) {
  const identity = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // signal: AbortSignal.timeout(8000),
    },
  }).then((r) => r.json());
  //   if (!identity.ok) throw err("INVALID_CREDENTIALS", `Google userinfo ${identity.status}`);

  if (!identity.email || !identity.email_verified) throw err("OAUTH_EMAIL_REQUIRED");
  return {
    email: String(identity.email),
    preferredPseudo: String(identity.given_name || identity.name || identity.email.split("@")[0]),
  };
}

async function loadFortyTwoIdentity(accessToken: string) {
  const identity = await fetch("https://api.intra.42.fr/v2/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      //   signal: AbortSignal.timeout(8000),
    },
  }).then((r) => r.json());
  //   if (!identity.ok) throw err("INVALID_CREDENTIALS", `42 /me ${identity.status}`);

  if (!identity.email) throw err("OAUTH_EMAIL_REQUIRED");
  return {
    email: String(identity.email),
    preferredPseudo: String(identity.login || identity.email.split("@")[0]),
  };
}

export async function finishLoginFromGithub(accessToken: string) {
  const identity = await loadGithubIdentity(accessToken);
  return findOrCreateOAuthUser(identity.email, identity.preferredPseudo);
}

export async function finishLoginFromGoogle(accessToken: string) {
  const identity = await loadGoogleIdentity(accessToken);
  return findOrCreateOAuthUser(identity.email, identity.preferredPseudo);
}

export async function finishLoginFromFortyTwo(accessToken: string) {
  const identity = await loadFortyTwoIdentity(accessToken);
  return findOrCreateOAuthUser(identity.email, identity.preferredPseudo);
}

export async function beginTwofaEnrollment(meId: number, issuer = process.env.TWOFA_ISSUER || "Transcendance") {
  const me = authModel.getById(meId);
  if (!me) throw err("USER_NOT_FOUND");
  if (me.is_2fa_enabled) throw err("TWOFA_ALREADY_ENABLED");

  // Generate a Base32 secret
  const secret = authenticator.generateSecret();

  // Build KEY URI (otpauth)
  const pseudoEnc = encodeURIComponent(me.pseudo);
  const issuerEnc = encodeURIComponent(issuer);
  const otpauth = `otpauth://totp/${issuerEnc}:${pseudoEnc}?secret=${secret}&issuer=${issuerEnc}&digits=6&period=30`;

  // Convert OTPAuth URI into a QR code
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  // Save pending encrypted secret
  const secretEnc = encryptGCM(secret);
  authModel.savePendingSecret(meId, secretEnc);

  return { otpauth, qrDataUrl };
}

export async function completeTwofaEnrollment(userId: number, code: string) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw err("USER_MISSING_FIELDS", "A 6-digit code is required");

  const pendingSecretEnc = authModel.loadPendingSecret(userId);
  if (!pendingSecretEnc) throw err("TWOFA_SETUP_REQUIRED");

  // TTL (Time To Live) 10min
  if (Date.now() - Date.parse(pendingSecretEnc.created_at + "Z") > 10 * 60 * 1000) {
    authModel.clearPendingSecret(userId);
    throw err("TWOFA_SETUP_REQUIRED");
  }

  // Decrypt secret in database
  const secretDec = decryptGCM(pendingSecretEnc.secret_enc);

  // Verify TOTP
  const verified = authenticator.verify({ token: code, secret: secretDec });
  if (!verified) throw err("TWOFA_INVALID_CODE");

  // Enable 2FA and store encrypted secret in user DB then clear pending.
  // withTX = db.transaction to commit both db actions or fail if one fails
  withTx(() => {
    authModel.set2FA(userId, true, pendingSecretEnc.secret_enc);
    authModel.clearPendingSecret(userId);
  });
}

export function disableTwofa(userId: number) {
  const me = authModel.getById(userId);
  if (!me) throw err("USER_NOT_FOUND");
  authModel.set2FA(userId, false, null);
}

export async function verifyTwofaLoginCode(userId: number, code: string) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw err("USER_MISSING_FIELDS", "A 6-digit code is required");

  const user = authModel.getById(userId);
  if (!user) throw err("USER_NOT_FOUND");
  if (!user.is_2fa_enabled || !user.twofa_secret_enc) throw err("TWOFA_SETUP_REQUIRED");

  const secretDec = decryptGCM(user.twofa_secret_enc);
  const verified = authenticator.verify({ token: code, secret: secretDec });
  if (!verified) throw err("TWOFA_INVALID_CODE");

  return { id: user.id, pseudo: user.pseudo, email: user.email };
}
