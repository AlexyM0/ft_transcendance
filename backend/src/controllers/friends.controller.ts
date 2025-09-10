// friends.controller.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import * as friendsService from "../services/friends.service";
import { err } from "../utils/errors";
import { FWOFriendDeleted, FWORequestSent, FWORequestUpdated } from "../types/ws_types";

const toInt = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

export async function getFriendsList(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const friends = friendsService.listFriends(meId);
  return rep.send({ friends });
}

export async function getPendingRequestsToMe(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const friendRequests = friendsService.listPendingToMe(meId);
  return rep.send({ friendRequests });
}

export async function getPendingRequestsFromMe(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const friendRequests = friendsService.listPendingFromMe(meId);
  return rep.send({ friendRequests });
}

export async function sendFriendRequest(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const { to_user_id } = (req.body as any) ?? {};
  const toUserId = toInt(to_user_id);

  if (!Number.isInteger(toUserId) || toUserId <= 0) throw err("BAD_USER_ID");

  const friendRequest = friendsService.sendFriendRequest(meId, Number(toUserId));
  const rooms = req.server.rooms;
  rooms.broadcastToUsers([meId, toUserId], {
    type: "friend_request_sent",
    id: friendRequest.id,
    from_user_id: friendRequest.from_user_id,
    to_user_id: friendRequest.to_user_id,
  } satisfies FWORequestSent);
  return rep.code(201).send(friendRequest.id);
}

export async function acceptFriendRequest(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const requestId = toInt((req.params as any).requestId);

  if (!Number.isInteger(requestId) || requestId <= 0) throw err("FRIEND_REQUEST_NOT_FOUND");

  const friendRequest = friendsService.acceptFriendRequest(meId, requestId);
  const rooms = req.server.rooms;
  rooms.broadcastToUsers([friendRequest.from_user_id, friendRequest.to_user_id], {
    type: "friend_request_updated",
    id: friendRequest.id,
    accepted: true,
  } satisfies FWORequestUpdated);
  return rep.send(friendRequest);
}

export async function declineFriendRequest(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const requestId = toInt((req.params as any).requestId);

  if (!Number.isInteger(requestId) || requestId <= 0) throw err("FRIEND_REQUEST_NOT_FOUND");

  const friendRequest = friendsService.declineRequest(meId, requestId);
  const rooms = req.server.rooms;
  rooms.broadcastToUsers([friendRequest.from_user_id, friendRequest.to_user_id], {
    type: "friend_request_updated",
    id: friendRequest.id,
    accepted: false,
  } satisfies FWORequestUpdated);
  return rep.send(friendRequest);
}

export async function deleteExistingFriend(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const friendId = toInt((req.params as any).friendId);

  if (!Number.isInteger(friendId) || friendId <= 0) throw err("BAD_USER_ID");

  const out = friendsService.removeFriend(meId, friendId);
  const rooms = req.server.rooms;
  rooms.broadcastToUsers([meId, friendId], {
    type: "friend_deleted",
    meId,
    friendId,
  } satisfies FWOFriendDeleted);
  return rep.send(out);
}
