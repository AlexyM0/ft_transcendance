// auth.model.ts
import { db } from "../utils/db";

export type AuthUserRow = {
  id: number;
  email: string;
  pseudo: string;
  pwd_hash: string;
  is_2fa_enabled: 0 | 1;
  twofa_secret_enc: string | null;
};

export type TwofaUserRow = {
  id: number;
  secret_enc: string;
  created_at: string;
};

/**
 * SQL commands
 */
const selectById = db.prepare(`SELECT id, email, pseudo, pwd_hash, is_2fa_enabled, twofa_secret_enc FROM users WHERE id = ?`);
const selectByLogin = db.prepare(`SELECT id, email, pseudo, pwd_hash, is_2fa_enabled, twofa_secret_enc FROM users WHERE email = ? OR pseudo = ? LIMIT 1`);
const insertUser = db.prepare(`INSERT INTO users (email, pseudo, pwd_hash) VALUES (?, ?, ?) RETURNING id`);
const update2faQuery = db.prepare(`UPDATE users SET is_2fa_enabled = ?, twofa_secret_enc = ? WHERE id = ?`);

const upsert2faEnrollment = db.prepare(`
	INSERT INTO twofa_enrollments (user_id, secret_enc)
	VALUES (?, ?)
	ON CONFLICT(user_id) 
	DO UPDATE SET secret_enc=excluded.secret_enc, created_at=strftime('%Y-%m-%d %H:%M:%f', 'now')
`);

const selectEnrollmentByUserId = db.prepare(`
	SELECT user_id, secret_enc, created_at
	FROM twofa_enrollments
	WHERE user_id = ?	
`);

const deleteEnrollment = db.prepare(`
	DELETE FROM twofa_enrollments WHERE user_id = ?
`);

/**
 * Model functions
 */
export function getById(id: number): AuthUserRow | undefined {
  return selectById.get(id) as AuthUserRow | undefined;
}

export function getByLogin(login: string): AuthUserRow | undefined {
  return selectByLogin.get(login, login) as AuthUserRow | undefined;
}

export function createUser(email: string, pseudo: string, pwdHash: string): { id: number } {
  return insertUser.get(email, pseudo, pwdHash) as { id: number };
}

export function set2FA(userId: number, enabled: boolean, enc: string | null) {
  return update2faQuery.run(enabled ? 1 : 0, enc, userId);
}

export function savePendingSecret(userId: number, secretEnc: string) {
  return upsert2faEnrollment.run(userId, secretEnc);
}

export function loadPendingSecret(userId: number): TwofaUserRow | undefined {
  return selectEnrollmentByUserId.get(userId) as TwofaUserRow | undefined;
}

export function clearPendingSecret(userId: number) {
  return deleteEnrollment.run(userId);
}
