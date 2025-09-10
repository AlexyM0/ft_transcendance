// friends.model.ts
import { db } from "../utils/db";

export type FriendRequestRow = {
  id: number;
  from_user_id: number;
  to_user_id: number;
  status: string;
  created_at: string;
};

/**
 * SQL commands
 */
export function getPending(fromId: number, toId: number) {
  const statement = db.prepare(`
	SELECT id, from_user_id, to_user_id, status, created_at
	FROM friend_requests
	WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'
	LIMIT 1
  `);
  return statement.get(fromId, toId) as FriendRequestRow | undefined;
}

export function getPendingId(fromId: number, toId: number) {
  const row = getPending(fromId, toId);
  return row ? row.id : null;
}

export function sendRequest(fromId: number, toId: number) {
  const insertRequest = db.prepare(`
	INSERT INTO friend_requests (from_user_id, to_user_id) VALUES (?, ?) RETURNING id, from_user_id, to_user_id
  `);
  return insertRequest.get(fromId, toId) as { id: number; from_user_id: number; to_user_id: number };
}

export function getRequestById(id: number) {
  const getRequest = db.prepare(`SELECT * FROM friend_requests WHERE id = ?`);
  return getRequest.get(id) as FriendRequestRow | undefined;
}

export function existingRequestBetween(a: number, b: number) {
  const getRequestBetween = db.prepare(`
	SELECT id, from_user_id, to_user_id
	FROM friend_requests
  	WHERE status = 'pending'
    AND (
      (from_user_id = ? AND to_user_id = ?)
      OR
      (from_user_id = ? AND to_user_id = ?)
    )
  	LIMIT 1
	`);
  return !!getRequestBetween.get(a, b, b, a);
}

export function acceptRequest(id: number) {
  const setRequestStatus = db.prepare(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`);
  return setRequestStatus.run(id);
}

export function deleteRequest(id: number) {
  const deleteRequestQuery = db.prepare(`DELETE from friend_requests WHERE id = ?`);
  return deleteRequestQuery.run(id);
}

export function deleteRequestBetween(a: number, b: number) {
  const deleteRequestBetweenQuery = db.prepare(`
	DELETE FROM friend_requests
  	WHERE (from_user_id = ? AND to_user_id = ?)
     OR (from_user_id = ? AND to_user_id = ?)`);
  return deleteRequestBetweenQuery.run(a, b, b, a);
}

export function insertFriendPair(a: number, b: number) {
  const [u, v] = a < b ? [a, b] : [b, a];
  const insertFriend = db.prepare(`INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)`); // canonical order required
  return insertFriend.run(u, v);
}

export function removeFriendPair(a: number, b: number) {
  const [u, v] = a < b ? [a, b] : [b, a];
  const deleteFriend = db.prepare(`DELETE FROM friendships WHERE user_id = ? AND friend_id = ?`);
  return deleteFriend.run(u, v);
}

export function areFriends(a: number, b: number) {
  const [u, v] = a < b ? [a, b] : [b, a];
  const areFriendsQuery = db.prepare(`SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? LIMIT 1`);
  return !!areFriendsQuery.get(u, v);
}

export function listPendingToMe(me: number) {
  const selectMyRequests = db.prepare(`
	SELECT fr.* FROM friend_requests fr
	WHERE fr.to_user_id = ? AND fr.status = 'pending'
	ORDER BY fr.created_at DESC	
`);
  return selectMyRequests.all(me) as FriendRequestRow[];
}

export function listPendingFromMe(me: number) {
  const selectMyRequests = db.prepare(`
	SELECT fr.* FROM friend_requests fr
	WHERE fr.from_user_id = ? AND fr.status = 'pending'
	ORDER BY fr.created_at DESC	
`);
  return selectMyRequests.all(me) as FriendRequestRow[];
}

export function listMyFriends(me: number) {
  const selectMyFriends = db.prepare(`
	SELECT CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END AS friend_id
	FROM friendships f
	WHERE f.user_id = ? OR f.friend_id = ?
`);
  return selectMyFriends.all(me, me, me) as Array<{ friend_id: number }>;
}
