// friends.service.ts
import * as friendsModel from "../models/friends.model";
import * as usersModel from "../models/users.model";
import { db } from "../utils/db";
import { err } from "../utils/errors";

function ensureUserExists(userId: number) {
  const user = usersModel.getPublicById(userId);
  if (!user) throw err("USER_NOT_FOUND");
}

export function listFriends(meId: number) {
  const rows = friendsModel.listMyFriends(meId);
  return rows.map((r) => usersModel.getPublicById(r.friend_id)).filter(Boolean);
}

export function listPendingForMe(meId: number) {
  return friendsModel.listPendingForMe(meId);
}

export function sendFriendRequest(meId: number, toUserId: number) {
  if (meId === toUserId) throw err("CANNOT_FRIEND_SELF");

  ensureUserExists(toUserId);

  if (friendsModel.existingRequestBetween(meId, toUserId)) throw err("FRIEND_REQUEST_ALREADY_EXISTS");
  if (friendsModel.areFriends(meId, toUserId)) throw err("ALREADY_FRIENDS");

  try {
    const { id } = friendsModel.sendRequest(meId, toUserId);
    return { id };
  } catch (e: any) {
    if (String(e?.message).includes("SQLITE_CONSTRAINT")) {
      throw err("FRIEND_REQUEST_ALREADY_EXISTS");
    }
    throw e;
  }
}

export function acceptFriendRequest(meId: number, requestId: number) {
  const friendRequest = friendsModel.getRequestById(requestId);
  if (!friendRequest) throw err("FRIEND_REQUEST_NOT_FOUND");
  if (friendRequest.to_user_id !== meId) throw err("FORBIDDEN"); // the request recipient must be me

  // Wrap in transaction (see notes for why we need this)
  const tx = db.transaction(() => {
    friendsModel.insertFriendPair(friendRequest.from_user_id, friendRequest.to_user_id);
    friendsModel.deleteRequest(requestId);
  });

  try {
    tx();
    return { success: true };
  } catch (e: any) {
    if (String(e?.message).includes("SQLITE_CONSTRAINT")) {
      friendsModel.deleteRequest(requestId);
      return { success: true };
    }
    throw e;
  }
}

export function declineRequest(meId: number, requestId: number) {
  const friendRequest = friendsModel.getRequestById(requestId);
  if (!friendRequest) throw err("FRIEND_REQUEST_NOT_FOUND");

  if (friendRequest.to_user_id !== meId && friendRequest.from_user_id !== meId) throw err("FORBIDDEN"); // either request sender and receiver can cancel the invite
  friendsModel.deleteRequest(requestId);
  return { success: true };
}

export function removeFriend(meId: number, friendId: number) {
  const tx = db.transaction(() => {
    friendsModel.removeFriendPair(meId, friendId);
    friendsModel.deleteRequestBetween(meId, friendId);
  });

  tx();
  return { success: true };
}
