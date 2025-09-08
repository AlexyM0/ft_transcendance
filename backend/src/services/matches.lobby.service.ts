// src/services/matches.lobby.service.ts
import { broadcastToUsers } from "../plugins/ws_hub";
import { type MatchSettingsWire, createDefaultSettingsWire } from "../plugins/ws_types";

type Invite = { id: number; from: number; to: number; createdAt: number };
type Lobby = {
  matchId: number;
  hostId: number;
  guestId: number;
  settings: MatchSettingsWire;
  locked: boolean;
  ready: Record<number, boolean>;
};

let inviteSeq = 1000;
let matchSeq = 2000;

const invites = new Map<number, Invite>();
const lobbies = new Map<number, Lobby>();

export function createInvite(from: number, to: number) {
  const id = ++inviteSeq;
  const invite = { id, from, to, createdAt: Date.now() };
  invites.set(id, invite);

  const payload = { type: "match_invite", inviteId: id, from, to } as const;
  broadcastToUsers([to, from], payload);
  return invite;
}

export function cancelInvite(inviteId: number, by: number) {
  const invite = invites.get(inviteId);
  if (!invite) return;
  if (invite.from !== by && invite.to !== by) return;
  invites.delete(inviteId);
  broadcastToUsers([invite.from, invite.to], { type: "match_invite_canceled", inviteId });
}

export function answerInvite(inviteId: number, by: number, accept: boolean) {
  const invite = invites.get(inviteId);
  if (!invite) return;
  if (invite.to !== by) return;
  invites.delete(inviteId);

  broadcastToUsers([invite.from, invite.to], { type: "match_invite_response", inviteId, accepted: accept });

  if (!accept) return;

  // Create lobby
  const matchId = ++matchSeq;
  const settings: MatchSettingsWire = createDefaultSettingsWire();
  const lobby: Lobby = {
    matchId,
    hostId: invite.from,
    guestId: invite.to,
    settings,
    locked: false,
    ready: { [invite.from]: false, [invite.to]: false },
  };
  lobbies.set(matchId, lobby);

  broadcastToUsers([invite.from, invite.to], {
    type: "match_lobby",
    matchId,
    hostId: lobby.hostId,
    guestId: lobby.guestId,
    settings: lobby.settings,
    locked: lobby.locked,
    ready: lobby.ready,
  });
  return lobby;
}

export function getLobby(matchId: number) {
  return lobbies.get(matchId);
}

export function setSettings(hostId: number, matchId: number, settings: MatchSettingsWire) {
  const lobby = lobbies.get(matchId);
  if (!lobby) return;
  if (lobby.hostId !== hostId) return;
  if (lobby.locked) return;
  lobby.settings = settings;
  broadcastToUsers([lobby.hostId, lobby.guestId], {
    type: "match_lobby",
    matchId,
    hostId: lobby.hostId,
    guestId: lobby.guestId,
    settings: lobby.settings,
    locked: lobby.locked,
    ready: lobby.ready,
  });
}

export function setReady(matchId: number, userId: number, ready: boolean) {
  const lobby = lobbies.get(matchId);
  if (!lobby) return;
  if (userId !== lobby.hostId && userId !== lobby.guestId) return;

  if (userId === lobby.hostId && ready) lobby.locked = true;

  lobby.ready[userId] = ready;
  broadcastToUsers([lobby.hostId, lobby.guestId], {
    type: "match_ready_state",
    matchId,
    userId,
    ready,
  });

  const both = !!lobby.ready[lobby.hostId] && !!lobby.ready[lobby.guestId];
  return { lobby, bothReady: both };
}

export function closeLobby(matchId: number) {
  lobbies.delete(matchId);
}
