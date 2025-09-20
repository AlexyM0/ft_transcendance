// tournaments.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import * as tournamentsService from "../services/tournaments.service";
import { err } from "../utils/errors";
import type {
  TournamentLite,
  TournamentPlayerSlot,
  TournamentMatch,
  TournamentFull,
  CreateTournamentPayload,
  UpdateAliasPayload,
} from "../types/state_types";

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export async function listTournaments(req: FastifyRequest, rep: FastifyReply) {
  const q = (req.query as any).q ?? "";
  const status = (req.query as any).status ?? "active";
  const limit = Number((req.query as any).limit ?? 50);
  const offset = Number((req.query as any).offset ?? 0);
  const tournaments = tournamentsService.listActiveTournaments(
    q,
    status,
    limit,
    offset
  );
  return rep.code(200).send(tournaments);
}

export async function createTournament(req: FastifyRequest, rep: FastifyReply) {
  const userId = Number((req.user as any).sub) as number;
  const payload = req.body as CreateTournamentPayload;
  const full = tournamentsService.createTournament(userId, payload);
  return rep.code(201).send(full);
}

export async function getTournamentDetails(
  req: FastifyRequest,
  rep: FastifyReply
) {
  const id = Number((req.params as any).tournamentId);
  return rep.code(200).send(tournamentsService.getTournament(id));
}

export async function joinTournament(req: FastifyRequest, rep: FastifyReply) {
  const userId = Number((req.user as any).sub) as number;
  const tournamentId = Number((req.params as any).tournamentId);
  // optional alias from body if you want parity with front later
  const alias = (req.body as any)?.alias ?? null;
  const full = tournamentsService.joinTournament(tournamentId, userId);
  return rep.code(201).send(full);
}

export async function leaveTournament(req: FastifyRequest, rep: FastifyReply) {
  const userId = Number((req.user as any).sub) as number;
  const tournamentId = Number((req.params as any).tournamentId);
  return rep
    .code(201)
    .send(tournamentsService.leaveTournament(tournamentId, userId));
}

export async function updateAlias(req: FastifyRequest, rep: FastifyReply) {
  const userId = Number((req.user as any).sub) as number;

  const tournamentId = Number((req.params as any).tournamentId);
  const payload = req.body as UpdateAliasPayload;
  return rep
    .code(201)
    .send(tournamentsService.updateAlias(tournamentId, userId, payload));
}

export async function startTournament(req: FastifyRequest, rep: FastifyReply) {
  const userId = Number((req.user as any).sub) as number;

  const tournamentId = Number((req.params as any).tournamentId);
  return rep
    .code(201)
    .send(tournamentsService.startTournament(tournamentId, userId));
}

export async function cancelTournament(req: FastifyRequest, rep: FastifyReply) {
  const userId = Number((req.user as any).sub) as number;
  const tournamentId = Number((req.params as any).tournamentId);

  tournamentsService.cancelTournament(tournamentId, userId);
  return rep.code(200).send({ deleted: true });
}

export async function recordTournamentMatchResult(
  req: FastifyRequest,
  rep: FastifyReply
) {
  const userId = Number((req.user as any).sub) as number;
  const matchId = Number((req.params as any).matchId);
  const { scoreP1, scoreP2 } = req.body as any;
  tournamentsService.recordMatchResult(
    matchId,
    Number(scoreP1),
    Number(scoreP2),
    userId
  );
  return rep.code(201).send({ updated: true });
}
