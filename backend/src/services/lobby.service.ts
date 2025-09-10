// src/services/lobby.service.ts
import { Rooms } from "../utils/ws_rooms";
import type { AllWsOutgoing } from "../types/ws_types";
import type { Invite, LobbySnapshot } from "../types/state_types";

const invites = new Map<number, Invite>();
const lobbies = new Map<number, LobbySnapshot>();

export function createInvite(from: number, to: number) {}
