// chat.routes.ts
import { FastifyPluginAsync, FastifyInstance } from "fastify";
import * as chatController from "../controllers/chat.controller";

export const chatRoutes: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  fastify.get("/", chatController.listChats); // List my chats
  fastify.get("/:chatId/messages", chatController.getMessagesFromAChat); // Fetch messages for a chat
  fastify.post("/:chatId/messages", chatController.sendMessage); // Send a new message
  fastify.post("/with/:userId", chatController.ensureChatWithUser);
  fastify.post("/with/:userId/messages", chatController.ensureChatAndSend);
};
