// tournaments.routes.ts
import { FastifyPluginAsync, FastifyInstance } from "fastify";
import * as tournamentController from "../controllers/tournaments.controller";

export const tournamentsRoutes: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  fastify.get("/", tournamentController.listTournaments); // List tournaments
  fastify.post("/", tournamentController.createTournament); // Create a tournament
  fastify.get("/:tournamentId", tournamentController.getTournamentDetails); // Tournament details
  fastify.post("/:tournamentId/join", tournamentController.joinATournament); // Join a tournament
  fastify.put("/:matchId/result", tournamentController.recordTournamentMatchResult); // Record match results
};
