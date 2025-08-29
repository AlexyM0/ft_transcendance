// chat.model.ts
import { db } from "../utils/db";

export type ChatRow = {
  id: number;
  user_a_id: number;
  user_b_id: number;
  created_at: string;
};

export type MessageRow = {
  id: number;
  author_id: number;
  body: string;
  created_at: string;
};

/**
 * SQL commands
 */
const selectByPair = db.prepare(`SELECT id FROM chats WHERE user_a_id = ? AND user_b_id = ?`);
const insertChat = db.prepare(`INSERT INTO chats (user_a_id, user_b_id) VALUES (?, ?) RETURNING id, user_a_id, user_b_id, created_at`);
const insertMessage = db.prepare(`INSERT INTO messages (chat_id, author_id, body) VALUES (?, ?, ?) RETURNING id, created_at`);
const selectMessagesAsc = db.prepare(`SELECT id, author_id, body, created_at FROM messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`);
const selectChatById = db.prepare(`SELECT id, user_a_id, user_b_id, created_at FROM chats WHERE id = ?`);
const listChatsForUserQuery = db.prepare(`
	SELECT
	c.id,
	c.user_a_id,
	c.user_b_id,
	c.created_at,
	(
		SELECT m.id
		FROM messages m
		WHERE m.chat_id = c.id
		ORDER BY m.created_at DESC
		LIMIT 1
	)                AS last_msg_id,
	(
		SELECT m.author_id
		FROM messages m
		WHERE m.chat_id = c.id
		ORDER BY m.created_at DESC
		LIMIT 1
	)                AS last_msg_author_id,
	(
		SELECT m.body
		FROM messages m
		WHERE m.chat_id = c.id
		ORDER BY m.created_at DESC
		LIMIT 1
	)                AS last_msg_body,
	(
		SELECT m.created_at
		FROM messages m
		WHERE m.chat_id = c.id
		ORDER BY m.created_at DESC
		LIMIT 1
	)                AS last_msg_created_at
	FROM chats c
	WHERE c.user_a_id = ? OR c.user_b_id = ?
	ORDER BY COALESCE(last_msg_created_at, c.created_at) DESC
	LIMIT ? OFFSET ?
`);

/**
 * Model functions
 */
export function ensureChat(user1: number, user2: number): { id: number } {
  const [a, b] = user1 < user2 ? [user1, user2] : [user2, user1];
  const existing = selectByPair.get(a, b) as { id: number } | undefined;
  return existing ? existing : (insertChat.get(a, b) as { id: number });
}

export function getChatById(chatId: number): ChatRow | undefined {
  return selectChatById.get(chatId) as ChatRow | undefined;
}

export function postMessage(chatId: number, authorId: number, body: string) {
  return insertMessage.get(chatId, authorId, body) as { id: number; created_at: string };
}

export function listMessagesAsc(chatId: number, limit = 50, offset = 0) {
  return selectMessagesAsc.all(chatId, limit, offset) as MessageRow[];
}

export function listChatsForUser(userId: number, limit = 50, offset = 0) {
  return listChatsForUserQuery.all(userId, userId, limit, offset) as Array<
    ChatRow & {
      last_msg_id: number | null;
      last_msg_author_id: number | null;
      last_msg_body: string | null;
      last_msg_created_at: string | null;
    }
  >;
}
