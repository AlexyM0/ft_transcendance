// user.routes.ts
import { FastifyPluginAsync, FastifyInstance } from "fastify";
import * as userController from "../controllers/user.controller";

export const usersRoutes: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  fastify.get("/me", userController.getMeProfile); // my profile (requires auth)
  fastify.put("/me", userController.updateMeProfile); // update my profile (name, bio, etc)
  fastify.put("/me/avatar", userController.uploadMeAvatar); // upload/replace my avatar
  fastify.delete("/me/avatar", userController.deleteMeAvatar); // delete my avatar

  fastify.get("/search", userController.searchForUser); // search for users
  fastify.get("/:id", userController.getPublicProfile); // another user's public profile
  fastify.get("/:id/matches", userController.getUserMatchHistory); // match history of a user
  fastify.get("/:id/stats", userController.getUserStats);

  //   fastify.fastify.get("/all", userController.getAllUsers);
};
