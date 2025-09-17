// frontend/src/helpers/LobbyOnlineState.ts
import { Realtime } from "./ws";
import type { AllWsIncoming, LWOInviteAnswer, LWOInviteCancel, LWOInviteSend, LWOLeave, LWOReady, LWOSetSettings } from "./ws_types";
import type { UserStatus, PublicUser, MatchSettingsSnapshot, LobbyState } from "./state_types";

const defaultSettings: MatchSettingsSnapshot = {
  pointsToWin: 3,
  paddleHeight: "medium",
  freeMove: false,
  hostSide: "left",
};

const state: LobbyState = {
  meId: null,
  opponent: null,
  settings: { ...defaultSettings },
  outgoing: null,
  inboxQueue: [],
  activeIncoming: null,
  userStatus: {},
  lobbySnapshot: null,
  loading: false,
  error: null,
};

/** Minimal reactive core */
type Listener = (s: LobbyState) => void;

const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(state);
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

/** WS wiring */
const realtime = new Realtime();

/**
 * **`onWs`** determines the behaviour of the lobby state when an incoming web socket message is received
 * @param msg The web socket message received is of type LobbyWsIncoming (see ws_types.ts)
 * Depending on msg, an outgoing response might be sent through WebSocket, using realtime.send()
 * This response is of type LobbyWsOutgoing (see ws_types.ts)
 */
function onWs(msg: AllWsIncoming) {
  switch (msg.type) {
    case "ready": {
      state.meId = msg.userId;
      emit();
      break;
    }

    case "user_status": {
      state.userStatus[msg.userId] = msg.status as UserStatus;
      emit();
      break;
    }

    case "lobby_invite_error": {
      // Server-side rejections (busy, already_invited, rate_limited, etc.)
      state.error = msg.message ?? msg.code;
      // If this was about our current outgoing flow, reset it so the UI overlay closes
      if (["target_busy", "already_invited", "rate_limited"].includes(msg.code)) {
        state.outgoing = null;
      }
      emit();
      break;
    }

    case "lobby_invite": {
      if (state.meId && msg.from === state.meId) {
        // Our own invite got an id
        if (!state.outgoing) break; // stale echo; ignore
        state.outgoing.inviteId = msg.inviteId;
        if (state.outgoing.cancelRequestedBeforeAck) {
          realtime.send({ type: "lobby_invite_cancel", inviteId: msg.inviteId } as LWOInviteCancel); // honor the earlier cancel
          state.outgoing.cancelRequestedBeforeAck = false;
        }
        emit();
      } else if (state.meId && msg.to === state.meId) {
        // Genuine incoming
        state.inboxQueue.push({ inviteId: msg.inviteId, from: msg.from });
        if (!state.activeIncoming) {
          state.activeIncoming = state.inboxQueue.shift()!;
        }
        emit();
      }
      break;
    }
    case "lobby_invite_canceled":
    case "lobby_invite_expired": {
      if (state.outgoing?.inviteId === msg.inviteId) {
        state.outgoing = null;
        emit();
      }
      // If an active incoming died, promote the next queued
      if (state.activeIncoming?.inviteId === msg.inviteId) {
        state.activeIncoming = null;
        state.activeIncoming = state.inboxQueue.shift() ?? null;
        emit();
      } else {
        // Or remove from queue if present
        const i = state.inboxQueue.findIndex((x) => x.inviteId === msg.inviteId);
        if (i >= 0) {
          state.inboxQueue.splice(i, 1);
          emit();
        }
      }
      break;
    }

    case "lobby_invite_response": {
      if (state.outgoing?.inviteId === msg.inviteId) {
        if (msg.accepted) {
          // Keep the waiting overlay up; we expect "match_lobby" next
          state.outgoing = null;
        } else {
          // Declined → clear outgoing so UI overlay closes
          state.outgoing = null;
        }
        emit();
      }
      break;
    }

    case "lobby_snapshot": {
      // Lobby formed — authoritative server snapshot
      state.lobbySnapshot = {
        lobbyId: msg.lobbySnapshot.lobbyId,
        hostId: msg.lobbySnapshot.hostId,
        guestId: msg.lobbySnapshot.guestId,
        settings: msg.lobbySnapshot.settings,
        locked: msg.lobbySnapshot.locked,
        ready: msg.lobbySnapshot.ready,
      };
      // Clear invites on both sides; we're moving to lobby
      state.outgoing = null;
      state.inboxQueue.length = 0;
      state.activeIncoming = null;
      emit();
      break;
    }

    case "match_created": {
      if (state.lobbySnapshot) {
        // state.lobbySnapshot.locked = true;
        sessionStorage.setItem(`play:online:current`, JSON.stringify({ matchId: msg.matchId, side: msg.side, snapshot: msg.snapshot }));
        Lobbies.resetLobby();
        location.hash = `/play/online/m`;
      }
      emit();
      break;
    }

    case "lobby_closed": {
      state.lobbySnapshot = null;
      emit();
      break;
    }
  }
}

/**
 * **`Lobbies`** encapsulates public interactions with the Lobbies state
 * Depending on the interaction, an outgoing response might be sent through WebSocket, using realtime.send()
 * This response is of type LobbyWsOutgoing (see ws_types.ts)
 */
let stopWsListener: (() => void) | null = null;

export const Lobbies = {
  init() {
    if (!stopWsListener) {
      stopWsListener = realtime.on(onWs);
      realtime.connect();
    }
  },

  shutdown() {
    if (stopWsListener) {
      stopWsListener();
      stopWsListener = null;
      realtime.close();
    }
  },

  /** View selects an opponent */
  selectOpponent(u: PublicUser | null) {
    state.opponent = u;
    emit();
  },

  /** View tweaks pre-lobby settings */
  setSettings(partial: Partial<MatchSettingsSnapshot>) {
    state.settings = { ...state.settings, ...partial };
    if (state.lobbySnapshot) {
      realtime.send({ type: "lobby_set_settings", lobbyId: state.lobbySnapshot.lobbyId, settings: state.settings } as LWOSetSettings);
    }
    emit();
  },

  /** Client-side hint; server remains authoritative */
  isUserBusy(userId: number) {
    const s = state.userStatus[userId];
    return s === "playing" || s === "in_lobby" || s === "dnd";
  },

  /** Is the Invite button currently allowed? */
  canInviteSelected() {
    const opp = state.opponent;
    if (!opp) return false;
    if (state.outgoing) return false; // already waiting on one
    if (this.isUserBusy(opp.id)) return false; // UI hint
    return true;
  },

  /** Send invite to the selected opponent */
  inviteSelected() {
    const opp = state.opponent;
    if (!opp) return;
    state.outgoing = {
      inviteId: null,
      to: opp.id,
      since: Date.now(),
      cancelRequestedBeforeAck: false,
    };
    emit();
    realtime.send({ type: "lobby_invite_send", from: state.meId!, to: opp.id } satisfies LWOInviteSend);
  },

  /** Cancel invite (works even if inviteId isn’t acked yet) */
  cancelInvite() {
    if (!state.outgoing) return;
    const id = state.outgoing.inviteId;
    if (id === null) {
      state.outgoing.cancelRequestedBeforeAck = true; // cancel once ack arrives
    } else {
      realtime.send({ type: "lobby_invite_cancel", inviteId: id } as LWOInviteCancel);
    }
    emit();
  },

  /** Respond to the currently active incoming invite */
  answerActiveInvite(accept: boolean) {
    if (!state.activeIncoming) return;
    const { inviteId } = state.activeIncoming;
    realtime.send({ type: "lobby_invite_answer", inviteId: inviteId, accept: accept } as LWOInviteAnswer);

    if (!accept) {
      // Decline → pop and show next queued invite, if any
      state.activeIncoming = state.inboxQueue.shift() ?? null;
      emit();
    } else {
      // Accept → wait for "match_lobby"; we keep the modal open or let the view close it
      state.activeIncoming = null;
      emit();
    }
  },

  /** Optional: when accepting one, decline all remaining queued invites */
  declineAllQueuedExcept(inviteId: number) {
    for (const inv of state.inboxQueue) {
      if (inv.inviteId !== inviteId) realtime.send({ type: "lobby_invite_answer", inviteId: inv.inviteId, accept: false } as LWOInviteAnswer);
    }
    state.inboxQueue = state.inboxQueue.filter((x) => x.inviteId === inviteId);
    emit();
  },

  /** Mark host start button ready */
  setReady(ready: boolean) {
    if (!state.lobbySnapshot || !state.meId) return;
    const lobbyId = state.lobbySnapshot.lobbyId;

    state.lobbySnapshot.ready[state.meId] = ready;
    emit();
    realtime.send({ type: "lobby_ready", lobbyId, ready } as LWOReady);
  },

  leaveLobby() {
    const lobbyId = state.lobbySnapshot?.lobbyId;
    if (!lobbyId) return;
    realtime.send({ type: "lobby_leave", lobbyId } as LWOLeave);
  },

  resetLobby() {
    state.meId = null;
    state.opponent = null;
    state.settings = { ...defaultSettings };
    state.outgoing = null;
    state.inboxQueue = [];
    state.activeIncoming = null;
    state.userStatus = {};
    state.lobbySnapshot = null;
    state.loading = false;
    state.error = null;
  },

  /** Read helpers for the view */
  getState() {
    return state;
  },
  getLobby() {
    return state.lobbySnapshot;
  },

  /** Re-export subscribe so views can attach */
  subscribe,
};
