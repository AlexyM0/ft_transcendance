// friends.routes
import { FastifyPluginAsync, FastifyInstance } from "fastify";
import * as friendsController from "../controllers/friends.controller";

export const friendsRoutes: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  fastify.get("/", friendsController.getFriendsList); // My friends list
  fastify.get("/requests", friendsController.getPendingRequests); // List my pending requests
  fastify.post("/requests", friendsController.sendFriendRequest); // Send friend request (body: { toUserId })
  fastify.put("/requests/:requestId", friendsController.acceptFriendRequest); // Accept a friend request
  fastify.delete("/requests/:requestId", friendsController.declineFriendRequest); // Decline/cancel request
  fastify.delete("/:friendId", friendsController.deleteExistingFriend); // Remove an existing friend
};
