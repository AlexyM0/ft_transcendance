// src/helpers/ws.ts

/**
 * Lightweight WebSocket client with auto-reconnect + heartbeat (no globals)
 *
 */
export type MatchSettingsWire = {
  pointsToWin: 3 | 5 | 7 | 9;
  paddleSize: "small" | "medium" | "large";
  freeMove: boolean;
  mode: "2d";
  hostSide: "left" | "right";
};

/**
 * Classification of the incoming web socket properties
 */
export type WsIncoming =
  | { type: "ready"; userId: number }
  | { type: "message"; chatId: number; message: any }
  | { type: "typing"; chatId: number; userId: number; isTyping: boolean; at: string }
  | { type: "presence"; userId: number; online: boolean }
  | { type: "friend_request"; id: number; from_user_id: number; to_user_id: number }
  | { type: "error"; code: string; message: string }
  | { type: "pong"; at: string }

  // Match lifecycle
  | { type: "match_invite"; inviteId: number; from: number; to: number }
  | { type: "match_invite_canceled"; inviteId: number }
  | { type: "match_invite_response"; inviteId: number; accepted: boolean }

  // Lobby + settings
  | { type: "match_lobby"; matchId: number; hostId: number; guestId: number; settings: MatchSettingsWire; locked: boolean; ready: Record<number, boolean> }

  // Ready / Cancel
  | { type: "match_ready_state"; matchId: number; userId: number; ready: boolean }

  // Countdown + start
  | { type: "match_countdown"; matchId: number; seconds: number }
  | { type: "match_start"; matchId: number; seed: number }

  // Runtime: server-authoritative snapshots
  | {
      type: "match_snapshot";
      matchId: number;
      t: number;
      state: {
        ball: { x: number; y: number; vx: number; vy: number };
        left: { x: number; y: number; vx: number; vy: number; score: number; id: number; name: string };
        right: { x: number; y: number; vx: number; vy: number; score: number; id: number; name: string };
        target: number;
        freeMove: boolean;
        paddleH: number;
      };
    }

  // Pause/resume (host or server decides policy)
  | { type: "match_paused"; matchId: number }
  | { type: "match_resumed"; matchId: number }

  // End
  | { type: "match_over"; matchId: number; winnerId: number; scoreL: number; scoreR: number };

/**
 *	A Listener is a function that takes a web socket as a parameter, performs some actions but does not return anything
 */
type Listener = (msg: WsIncoming) => void;

/**
 * Encapsulate the web socket we create with methods to use it
 */
export class Realtime {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners = new Set<Listener>();
  private reconnectAttemps = 0;
  private heartbeatTimer: number | null = null;
  private heartbeatMs = 25_000;
  private connected = false;
  private manualClose = false;

  /**
   * The constructor defines the url based on the protocol we use (http vs https)
   */
  constructor(url: "/api/ws") {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    this.url = url.startsWith("ws") ? url : `${protocol}://${location.host}${url}`;
  }

  /**
   * Adds a function to the set of listeners and returns a callback function to remove it later
   */
  on(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Opens the websocket and sets a flag to mark the socket as not closed
   */
  connect() {
    this.manualClose = false;
    this.open();
  }

  /**
   * Closes the websocket and cleans the class state
   */
  close() {
    this.manualClose = true;
    this.stopHearthbeat();
    this.ws?.close(1000, "client close");
    this.ws = null;
  }

  /**
   * Converts the object passed in parameter to string and sends it over the websocket
   */
  send(frame: object) {
    const txt = JSON.stringify(frame);
    if (this.ws && this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(txt);
    }
  }

  /**
   * Sends the incoming "subscribe" object to the web socket
   */
  subscribe(chatId: number) {
    this.send({ type: "subscribe", chatId });
  }

  /**
   * Sends the incoming "unsubscribe" object to the web socket
   */
  unsubscribe(chatId: number) {
    this.send({ type: "unsubscribe", chatId });
  }

  /**
   * Sends the incoming "typing" object to the web socket
   */
  typing(chatId: number, isTyping: boolean) {
    this.send({ type: "typing", chatId, isTyping });
  }

  /**
   * Sends the incoming "ping" object to the web socket
   */
  ping() {
    this.send({ type: "ping" });
  }

  subscribeMatch(matchId: number) {
    this.send({ type: "subscribe_match", matchId });
  }

  unsubscribeMatch(matchId: number) {
    this.send({ type: "unsubscribe_match", matchId });
  }

  inviteSend(to: number) {
    this.send({ type: "invite_send", to });
  }

  inviteCancel(inviteId: number) {
    this.send({ type: "invite_cancel", inviteId });
  }

  inviteAnswer(inviteId: number, accept: boolean) {
    this.send({ type: "invite_answer", inviteId, accept });
  }

  matchSetSettings(matchId: number, settings: MatchSettingsWire) {
    this.send({ type: "match_settings", matchId, settings });
  }

  matchReady(matchId: number, ready: boolean) {
    this.send({ type: "match_ready", matchId, ready });
  }

  matchInput(matchId: number, key: "up" | "down" | "left" | "right", pressed: boolean) {
    this.send({ type: "match_input", matchId, key, pressed, at: performance.now() });
  }

  matchTogglePause(matchId: number) {
    this.send({ type: "match_toggle_pause", matchId });
  }
  /**
   * Private functions :
   * Creates a web socket based on this class url and defines the callbacks
   * need by a web socket : onopen, onmessage, onclose and onerror
   */
  private open() {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.reconnectAttemps = 0;
      this.startHearthbeat();
    };

    ws.onmessage = (ev) => {
      let msg: WsIncoming | null = null;
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : "") as WsIncoming;
      } catch {}
      if (!msg) return;
      for (const l of this.listeners) {
        l(msg);
      }
    };

    ws.onclose = () => {
      this.connected = false;
      this.stopHearthbeat();
      if (this.manualClose) return;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // Let onclose handle the backoff
    };
  }

  private scheduleReconnect() {
    this.reconnectAttemps++;
    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttemps), 15_000);
    setTimeout(() => {
      if (!this.manualClose) this.open();
    }, backoff);
  }

  private startHearthbeat() {
    this.stopHearthbeat();
    const tick = () => {
      if (!this.connected) return;
      this.ping();
      this.heartbeatTimer = window.setTimeout(tick, this.heartbeatMs);
    };
    this.heartbeatTimer = window.setTimeout(tick, this.heartbeatMs);
  }

  private stopHearthbeat() {
    if (this.heartbeatTimer !== null) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
