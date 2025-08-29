// tournaments.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import * as tournamentsService from "../services/tournaments.service";
import { err } from "../utils/errors";

export async function listTournaments(req: FastifyRequest, rep: FastifyReply) {
  const { limit = 50, offset = 0 } = (req.query as any) ?? {};
  const items = tournamentsService.listTournaments(Number(limit), Number(offset));
  return rep.send({ tournaments: items, limit: Number(limit), offset: Number(offset) });
}

export async function createTournament(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const { title, description = null, maxPlayers = 8 } = (req.body as any) ?? {};

  if (!title) throw err("BAD_TITLE");

  const tournament = tournamentsService.createTournament(meId, String(title), description ? String(description) : null, Number(maxPlayers));
  return rep.code(201).send(tournament);
}

export async function getTournamentDetails(req: FastifyRequest, rep: FastifyReply) {
  const tournamentId = Number((req.params as any).tournamentId);
  const { tournament, participants } = tournamentsService.getTournamentDetails(tournamentId);
  return rep.send({ tournament, participants });
}

export async function joinATournament(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const tournamentId = Number((req.params as any).tournamentId);

  const out = tournamentsService.joinTournament(tournamentId, meId);
  return rep.send(out);
}

export async function recordTournamentMatchResult(req: FastifyRequest, rep: FastifyReply) {
  const matchId = Number((req.params as any).matchId);
  const { scoreP1, scoreP2 } = (req.body as any) ?? {};

  if (scoreP1 == null || scoreP2 == null) throw err("MISSING_SCORES");

  const updated = tournamentsService.recordTournamentMatchResult(matchId, Number(scoreP1), Number(scoreP2));
  return rep.send(updated);
}
