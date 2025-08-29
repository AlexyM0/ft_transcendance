// friends.controller.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import * as friendsService from "../services/friends.service";
import { err } from "../utils/errors";

const toInt = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

export async function getFriendsList(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const friends = friendsService.listFriends(meId);
  return rep.send({ friends });
}

export async function getPendingRequests(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const friendRequests = friendsService.listPendingForMe(meId);
  return rep.send({ friendRequests });
}

export async function sendFriendRequest(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const { to_user_id } = (req.body as any) ?? {};
  const toUserId = toInt(to_user_id);

  if (!Number.isInteger(toUserId) || toUserId <= 0) throw err("BAD_USER_ID");

  const { id } = friendsService.sendFriendRequest(meId, Number(toUserId));
  return rep.code(201).send({ id });
}

export async function acceptFriendRequest(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const requestId = toInt((req.params as any).requestId);

  if (!Number.isInteger(requestId) || requestId <= 0) throw err("FRIEND_REQUEST_NOT_FOUND");

  const out = friendsService.acceptFriendRequest(meId, requestId);
  return rep.send(out);
}

export async function declineFriendRequest(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const requestId = toInt((req.params as any).requestId);

  if (!Number.isInteger(requestId) || requestId <= 0) throw err("FRIEND_REQUEST_NOT_FOUND");

  const out = friendsService.declineRequest(meId, requestId);
  return rep.send(out);
}

export async function deleteExistingFriend(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const friendId = toInt((req.params as any).friendId);

  if (!Number.isInteger(friendId) || friendId <= 0) throw err("BAD_USER_ID");

  const out = friendsService.removeFriend(meId, friendId);
  return rep.send(out);
}
