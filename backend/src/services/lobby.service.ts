// backend/src/services/lobby.service.ts
import type { AllWsOutgoing, LWOClosed, LWOInvite, LWOInviteCanceled, LWOInviteError, LWOInviteExpired, LWOInviteResponse, LWOLobbySnapshot, MWOCreated, SWOUserStatus } from "../types/ws_types";
import { createDefaultMatchSettings, MatchSettingsSnapshot, type InviteSnapshot, type InviteState, type LobbySnapshot, type LobbyUserSnapshot, type UserStatus } from "../types/state_types";
import { matchStateToSnapshot } from "../utils/GameSnapshot";
import * as matchService from "../services/matches.service";
import * as gameService from "../services/game.service";

/** Data structures */
const INVITE_TTL_MS = 30_000;

let nextInviteId = 1;
let nextLobbyId = 1;

const invites = new Map<number, InviteSnapshot>();
const pendingByPair = new Map<string, number>();
const pendingByUser = new Map<number, number>();
const userStatus = new Map<number, UserStatus>();
const lobbyById = new Map<number, LobbySnapshot>();
const lobbyByUser = new Map<number, LobbySnapshot>();

/** -- Emitter for timeout */
type LobbyEmit = { targets: number[]; payload: AllWsOutgoing };
let emit: (e: LobbyEmit) => void = () => {};
export function setLobbyEmitter(fn: (e: LobbyEmit) => void) {
  emit = fn;
}

/** -- Helpers */
function pairKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function setStatus(userId: number, status: UserStatus) {
  userStatus.set(userId, status);
  return { userId, status } satisfies LobbyUserSnapshot;
}

export function getStatus(userId: number): UserStatus {
  return userStatus.get(userId) ?? "available";
}

export function onUserConnected(userId: number) {
  setStatus(userId, userStatus.get(userId) ?? "available");
  return { userId, status: "available" } satisfies LobbyUserSnapshot;
}

export function onUserDisconnected(userId: number) {
  const outs: Array<{ targets: number[]; payload: AllWsOutgoing }> = [];

  const lobby = lobbyByUser.get(userId);
  if (lobby) {
    const res = closeLobby(lobby.lobbyId, "disconnect");
    if (res) outs.push(res);
  }
  const inv = pendingByUser.get(userId);
  if (inv) {
    const res = forceExpireOrCancelInvite(inv, "expired");
    if (res) outs.push({ targets: [res.from, res.to], payload: res.payload });
  }
  setStatus(userId, "available");

  // flush via emitter
  for (const e of outs) emit(e);
}

function statusMsg(userId: number, status: UserStatus): SWOUserStatus {
  return { type: "user_status", userId, status };
}

/* ==================================================== */
/* ================== INVITES ========================= */
/* ==================================================== */

export function forceExpireOrCancelInvite(inviteId: number, kind: InviteState) {
  const inv = invites.get(inviteId);
  if (!inv || inv.state !== "pending") return;

  inv.state = kind === "expired" ? "expired" : "canceled";
  if (inv.timer) {
    clearTimeout(inv.timer);
    inv.timer = null;
  }

  pendingByPair.delete(pairKey(inv.from, inv.to));
  pendingByUser.delete(inv.from);
  pendingByUser.delete(inv.to);
  invites.delete(inviteId);

  const payload = kind === "expired" ? ({ type: "lobby_invite_expired", inviteId } as LWOInviteExpired) : ({ type: "lobby_invite_canceled", inviteId } satisfies LWOInviteCanceled);
  return { from: inv.from, to: inv.to, payload };
}

export function inviteSend(from: number, to: number) {
  if (from === to) {
    const payload: LWOInviteError = { type: "lobby_invite_error", code: "target_busy", message: "Self-invite not allowed" };
    return { targets: [from], payload };
  }

  // Busy if in lobby/playing/DND or has any pending invite
  const toBusy = ["in_lobby", "playing", "dnd"].includes(getStatus(to)) || pendingByUser.has(to);
  if (toBusy) {
    const payload: LWOInviteError = { type: "lobby_invite_error", code: "target_busy" };
    return { targets: [from], payload };
  }

  const key = pairKey(from, to);
  if (pendingByPair.has(key)) {
    const payload: LWOInviteError = { type: "lobby_invite_error", code: "already_invited" };
    return { targets: [from, to], payload };
  }

  const id = nextInviteId++;
  const inv: InviteSnapshot = {
    id,
    from,
    to,
    state: "pending",
    expiresAt: Date.now() + INVITE_TTL_MS,
    timer: null,
  };
  invites.set(id, inv);
  pendingByPair.set(key, id);
  pendingByUser.set(from, id);
  pendingByUser.set(to, id);

  inv.timer = setTimeout(() => {
    const res = forceExpireOrCancelInvite(id, "expired");
    if (res) emit({ targets: [res.from, res.to], payload: res.payload });
  }, INVITE_TTL_MS);
  const payload: LWOInvite = { type: "lobby_invite", inviteId: id, from, to };
  return { targets: [from, to], payload };
}

export function inviteCancel(meId: number, inviteId: number) {
  const inv = invites.get(inviteId);
  if (!inv || inv.state !== "pending") {
    const payload: LWOInviteError = { type: "lobby_invite_error", code: "invite_not_pending" };
    return { targets: [meId], payload };
  }
  if (inv.from !== meId) {
    const payload: LWOInviteError = { type: "lobby_invite_error", code: "invite_not_pending" };
    return { targets: [meId], payload };
  }

  const res = forceExpireOrCancelInvite(inviteId, "canceled");
  if (!res) {
    const payload: LWOInviteError = { type: "lobby_invite_error", code: "invite_not_pending" };
    return { targets: [inv.from, inv.to], payload };
  }
  return { targets: [res.from, res.to], payload: res.payload };
}

export function inviteAnswer(meId: number, inviteId: number, accept: boolean) {
  const inv = invites.get(inviteId);

  if (!inv || inv.state !== "pending") {
    const payload: LWOInviteError = { type: "lobby_invite_error", code: "invite_not_pending" };
    return { targets: [meId], payload };
  }
  if (inv.to !== meId) {
    const payload: LWOInviteError = { type: "lobby_invite_error", code: "invite_not_pending" };
    return { targets: [meId], payload };
  }

  inv.state = "answered";
  if (inv.timer) {
    clearTimeout(inv.timer);
    inv.timer = null;
  }
  pendingByPair.delete(pairKey(inv.from, inv.to));
  pendingByUser.delete(inv.from);
  pendingByUser.delete(inv.to);

  const payload: LWOInviteResponse = { type: "lobby_invite_response", inviteId, accepted: !!accept };
  return { targets: [inv.from, inv.to], payload };
}

export function createLobby(invFrom: number, invTo: number) {
  const lobbyId = nextLobbyId++;
  const lobby: LobbySnapshot = {
    lobbyId,
    hostId: invFrom,
    guestId: invTo,
    settings: createDefaultMatchSettings(),
    locked: false,
    ready: { [invFrom]: false, [invTo]: false },
  };
  lobbyById.set(lobbyId, lobby);
  lobbyByUser.set(invFrom, lobby);
  lobbyByUser.set(invTo, lobby);

  setStatus(invFrom, "in_lobby");
  setStatus(invTo, "in_lobby");

  const payload: LWOLobbySnapshot = {
    type: "lobby_snapshot",
    lobbyId,
    lobbySnapshot: lobby,
  };

  emit({ targets: [invFrom, invTo], payload: statusMsg(invFrom, "in_lobby") });
  emit({ targets: [invFrom, invTo], payload: statusMsg(invTo, "in_lobby") });
  return { targets: [invFrom, invTo], payload };
}

/* ==================================================== */
/* ==================== LOBBY ========================= */
/* ==================================================== */

export function setSettings(lobbyId: number, userId: number, settings: MatchSettingsSnapshot) {
  const lobby = lobbyById.get(lobbyId);
  if (!lobby) return;

  if (lobby.locked || lobby.hostId !== userId) return;

  lobby.settings = {
    ...lobby.settings,
    ...settings,
  };

  const payload: LWOLobbySnapshot = {
    type: "lobby_snapshot",
    lobbyId,
    lobbySnapshot: lobby,
  };
  return { targets: [lobby.hostId, lobby.guestId], payload };
}

export function setReady(lobbyId: number, userId: number, ready: boolean) {
  const lobby = lobbyById.get(lobbyId);
  if (!lobby) return;

  if (userId === lobby.hostId && ready) {
    const match = matchService.createMatch(lobby.hostId, lobby.guestId);
    const hostSide = lobby.settings.hostSide;
    const guestSide = hostSide === "left" ? "right" : "left";
    const me = match.p1_id === lobby.hostId ? { id: match.p1_id, name: match.p1_pseudo, avatar_url: match.p1_avatar_url } : { id: match.p2_id, name: match.p2_pseudo, avatar_url: match.p2_avatar_url };
    const opp =
      match.p1_id === lobby.guestId ? { id: match.p1_id, name: match.p1_pseudo, avatar_url: match.p1_avatar_url } : { id: match.p2_id, name: match.p2_pseudo, avatar_url: match.p2_avatar_url };

    const matchRuntime = gameService.createMatch({
      matchId: match.id,
      leftUserId: hostSide === "left" ? lobby.hostId : lobby.guestId,
      rightUserId: hostSide === "right" ? lobby.hostId : lobby.guestId,
      me,
      opp,
      hostSide,
      settings: lobby.settings,
    });

    const hostPayload: MWOCreated = { type: "match_created", matchId: match.id, side: hostSide, snapshot: matchStateToSnapshot(matchRuntime.state) };
    const guestPayload: MWOCreated = { type: "match_created", matchId: match.id, side: guestSide, snapshot: matchStateToSnapshot(matchRuntime.state) };

    closeLobby(lobbyId, "match_created");
    return [
      { targets: [lobby.hostId], payload: hostPayload },
      { targets: [lobby.guestId], payload: guestPayload },
    ];
  }
}

export function leaveLobby(lobbyId: number, userId: number) {
  const lobby = lobbyById.get(lobbyId);
  if (!lobby) return;

  if (userId !== lobby.hostId && userId !== lobby.guestId) return;
  const res = closeLobby(lobbyId, "left");
  return res;
}

function closeLobby(lobbyId: number, reason: "left" | "disconnect" | "match_created") {
  const lobby = lobbyById.get(lobbyId);
  if (!lobby) return;

  lobbyById.delete(lobbyId);
  lobbyByUser.delete(lobby.hostId);
  lobbyByUser.delete(lobby.guestId);

  const payload: LWOClosed = {
    type: "lobby_closed",
    lobbyId,
  };

  setStatus(lobby.hostId, "available");
  setStatus(lobby.guestId, "available");

  if (reason === "left") {
    emit({ targets: [lobby.hostId, lobby.guestId], payload: statusMsg(lobby.hostId, "available") });
    emit({ targets: [lobby.hostId, lobby.guestId], payload: statusMsg(lobby.guestId, "available") });
  }

  return { targets: [lobby.hostId, lobby.guestId], payload };
}

export function userHasLobby(userId: number) {
  return lobbyByUser.has(userId);
}
