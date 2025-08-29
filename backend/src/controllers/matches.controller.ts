// matches.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import * as matchesService from "../services/matches.service";
import { err } from "../utils/errors";
import { match } from "assert";

const toInt = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

export async function createNewMatch(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const { opponentId } = (req.body as any) ?? {};

  const oppId = toInt(opponentId);
  if (!Number.isInteger(oppId) || oppId <= 0) throw err("BAD_USER_ID");

  const match = matchesService.createMatch(meId, oppId);
  return rep.code(201).send(match);
}

export async function getMatchDetails(req: FastifyRequest, rep: FastifyReply) {
  const matchId = toInt((req.params as any).matchId);

  if (!Number.isInteger(matchId) || matchId <= 0) throw err("BAD_MATCH_ID");

  const match = matchesService.getMatch(matchId);
  return rep.send(match);
}

export async function recordMatchResult(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const matchId = toInt((req.params as any).matchId);

  if (!Number.isInteger(matchId) || matchId <= 0) throw err("BAD_MATCH_ID");

  const { scoreP1, scoreP2 } = (req.body as any) ?? {};

  if (scoreP1 == null || scoreP2 == null) throw err("MISSING_SCORES");

  const updated = matchesService.recordResult(meId, matchId, Number(scoreP1), Number(scoreP2));
  return rep.send(updated);
}

export async function cancelMatch(req: FastifyRequest, rep: FastifyReply) {
  const meId = Number((req.user as any).sub);
  const matchId = toInt((req.params as any).matchId);

  if (!Number.isInteger(matchId) || matchId <= 0) throw err("BAD_MATCH_ID");

  const updated = matchesService.cancelMatch(meId, matchId);
  return rep.send(updated);
}
