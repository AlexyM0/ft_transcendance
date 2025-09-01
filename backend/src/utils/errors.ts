// errors.ts
/**
 * STATUS -> HTTP status number (e.g., 404)
 * CODE -> Internal string code (e.g, "MATCH_NOT_FOUND")
 * MESSAGE -> Human readable message
 */

/**
 * Export a READONLY type that maps an Error Type with a status and a message
 */
export const CODES = {
  // Auth / User
  USER_NOT_FOUND: { status: 404, message: "User not found" },
  USER_MISSING_FIELDS: { status: 400, message: "Missing fields" },
  USER_ALREADY_EXISTS: { status: 409, message: "User already exists" },
  PSEUDO_TAKEN: { status: 409, message: "Pseudo already taken" },
  BAD_EMAIL: { status: 400, message: "Invalid email" },
  BAD_PSEUDO: { status: 400, message: "Invalid pseudo" },
  BAD_LIMIT: { status: 400, message: "Invalid limit" },
  BAD_OFFSET: { status: 400, message: "Invalid offset" },
  BAD_USER_ID: { status: 400, message: "Invalid user id" },
  INVALID_CREDENTIALS: { status: 401, message: "Invalid credentials" },
  MISSING_AVATAR_URL: { status: 400, message: "avatar_url required" },
  UNSUPPORTED_IMAGE_TYPE: { status: 400, message: "Unsupported image type" },
  OAUTH_EMAIL_REQUIRED: { status: 400, message: "OAuth email required" },
  TWOFA_SETUP_REQUIRED: { status: 401, message: "2FA setup pending or expired" },
  TWOFA_INVALID_CODE: { status: 401, message: "Invalid 2FA code" },
  TWOFA_ALREADY_ENABLED: { status: 409, message: "2FA already set up" },
  TWOFA_NOT_ENABLED: { status: 400, message: "2FA not enabled" },

  // Chat
  CHAT_NOT_FOUND: { status: 404, message: "Chat not found" },
  CHAT_FORBIDDEN: { status: 403, message: "Chat forbidden" },
  CHAT_BODY_EMPTY: { status: 400, message: "Message body required" },
  CHAT_BODY_TOO_LONG: { status: 413, message: "Message body too long" },
  SELF_CHAT_FORBIDDEN: { status: 400, message: "Cannot chat with yourself" },

  // Friends
  CANNOT_FRIEND_SELF: { status: 400, message: "Cannot send friend request to yourself" },
  FRIEND_REQUEST_ALREADY_EXISTS: { status: 409, message: "Friend request already exists" },
  FRIEND_REQUEST_NOT_FOUND: { status: 404, message: "Friend request not found" },
  ALREADY_FRIENDS: { status: 409, message: "Cannot send friend request to an already friend" },

  // Matches / Tournament
  SAME_PLAYER: { status: 400, message: "Players must be different" },
  BAD_MATCH_ID: { status: 400, message: "Invalid match ID" },
  MISSING_SCORES: { status: 400, message: "Scores P1 and P2 should be provided" },
  BAD_TITLE: { status: 400, message: "Tournament should have a title" },
  MATCH_NOT_FOUND: { status: 404, message: "Match not found" },
  FORBIDDEN: { status: 403, message: "Forbidden" },
  BAD_SCORES: { status: 400, message: "Scores must be non-negative integers" },
  NOT_PENDING: { status: 409, message: "Match is not pending" },
  TOURNAMENT_NOT_FOUND: { status: 404, message: "Tournament not found" },
  NOT_IN_REGISTRATION: { status: 400, message: "Tournament not in registration" },
  TOURNAMENT_FULL: { status: 400, message: "Tournament already full" },
  ALREADY_REPORTED: { status: 409, message: "Result already submitted" },
  MATCH_NOT_READY: { status: 400, message: "Match players not set yet" },
  DRAW_NOT_ALLOWED: { status: 400, message: "Draws are not allowed" },

  // CORS
  NOT_ALLOWED_BY_CORS: { status: 403, message: "Not allowed by CORS" },
} as const;

/**
 * Define an enum-like type based on the keys of the Error Type map
 */
export type AppErrorCode = keyof typeof CODES;

/**
 * Define a custom Error class with 3 fields that will be used to send the HTTP response :
 * code, status and message
 */
export class AppError extends Error {
  code: AppErrorCode;
  status: number;

  constructor(code: AppErrorCode, messageOverride?: string) {
    super(messageOverride ?? CODES[code].message);
    this.code = code;
    this.status = CODES[code].status;

    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "AppError";
  }
}

/**
 * Define an err function to make throw syntax easy
 * Usage : throw err("APP_ERROR_CODE")
 * Without this function, we would have : throw new AppError("APP_ERROR_CODE")
 */
export const err = (code: AppErrorCode, messageOverride?: string) => new AppError(code, messageOverride);
