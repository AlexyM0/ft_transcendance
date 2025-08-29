// friends.model.ts
import { db } from "../utils/db";

/**
 * SQL commands
 */
const insertRequest = db.prepare(`INSERT INTO friend_requests (from_user_id, to_user_id) VALUES (?, ?) RETURNING id`);
const getRequest = db.prepare(`SELECT * FROM friend_requests WHERE id = ?`);
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

const setRequestStatus = db.prepare(`UPDATE friend_requests SET status = ? WHERE id = ?`);
const deleteRequestQuery = db.prepare(`DELETE from friend_requests WHERE id = ?`);
const deleteRequestBetweenQuery = db.prepare(`
	DELETE FROM friend_requests
  	WHERE (from_user_id = ? AND to_user_id = ?)
     OR (from_user_id = ? AND to_user_id = ?)`);
const insertFriend = db.prepare(`INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)`); // canonical order required
const deleteFriend = db.prepare(`DELETE FROM friendships WHERE user_id = ? AND friend_id = ?`);
const areFriendsQuery = db.prepare(`SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? LIMIT 1`);
const selectMyRequests = db.prepare(`
	SELECT fr.* FROM friend_requests fr
	WHERE fr.to_user_id = ? AND fr.status = 'pending'
	ORDER BY fr.created_at DESC	
`);
const selectMyFriends = db.prepare(`
	SELECT CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END AS friend_id
	FROM friendships f
	WHERE f.user_id = ? OR f.friend_id = ?
`);

/**
 * Model functions
 */
export function sendRequest(fromId: number, toId: number) {
  return insertRequest.get(fromId, toId) as { id: number };
}

export function getRequestById(id: number) {
  return getRequest.get(id) as any | undefined;
}

export function existingRequestBetween(a: number, b: number) {
  return !!getRequestBetween.get(a, b, b, a);
}

export function acceptRequest(id: number) {
  return setRequestStatus.run("accepted", id);
}

export function deleteRequest(id: number) {
  return deleteRequestQuery.run(id);
}

export function deleteRequestBetween(a: number, b: number) {
  return deleteRequestBetweenQuery.run(a, b, b, a);
}

export function insertFriendPair(a: number, b: number) {
  const [u, v] = a < b ? [a, b] : [b, a];
  return insertFriend.run(u, v);
}

export function removeFriendPair(a: number, b: number) {
  const [u, v] = a < b ? [a, b] : [b, a];
  return deleteFriend.run(u, v);
}

export function areFriends(a: number, b: number) {
  const [u, v] = a < b ? [a, b] : [b, a];
  return !!areFriendsQuery.get(u, v);
}

export function listPendingForMe(me: number) {
  return selectMyRequests.all(me) as any[];
}

export function listMyFriends(me: number) {
  return selectMyFriends.all(me, me, me) as Array<{ friend_id: number }>;
}
