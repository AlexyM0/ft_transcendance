// matches.route.ts
import { FastifyPluginAsync, FastifyInstance } from "fastify";
import * as matchesController from "../controllers/matches.controller";

export const matchesRoutes: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  fastify.post("/", matchesController.createNewMatch); // Create a new match : (body: { opponentId })
  fastify.get("/:matchId", matchesController.getMatchDetails); // Get match details
  fastify.put("/:matchId/result", matchesController.recordMatchResult); // Record/update result
  fastify.put("/:matchId/cancel", matchesController.cancelMatch);
};
