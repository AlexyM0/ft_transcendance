// tournaments.routes.ts
import { FastifyPluginAsync, FastifyInstance } from "fastify";
import * as tournamentController from "../controllers/tournaments.controller";

export const tournamentsRoutes: FastifyPluginAsync = async function (fastify: FastifyInstance) {
  fastify.get("/", tournamentController.listTournaments); // List tournaments
  fastify.post("/", tournamentController.createTournament); // Create a tournament
  fastify.get("/:tournamentId", tournamentController.getTournamentDetails); // Tournament details
  fastify.post("/:tournamentId/join", tournamentController.joinTournament); // Join a tournament
  fastify.post("/:tournamentId/leave", tournamentController.leaveTournament);
  fastify.put("/:tournamentId/alias", tournamentController.updateAlias);
  fastify.post("/:tournamentId/start", tournamentController.startTournament);
  fastify.put("/:matchId/result", tournamentController.recordTournamentMatchResult); // Record match results
};
