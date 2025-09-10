// src/routes/ws.routes.ts

import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import * as wsController from "../controllers/ws.controller";

export const wsRoutes: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  fastify.get("", { websocket: true }, wsController.wsController);
};
