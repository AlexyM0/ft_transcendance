// src/helpers/ws.ts
import type { AllWsIncoming, SWOPing } from "./ws_types";
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

export type UserStatus = "online" | "in_lobby" | "playing" | "offline" | "dnd";

/**
 *	A Listener is a function that takes a web socket as a parameter, performs some actions but does not return anything
 */
export type Listener = (msg: AllWsIncoming) => void;

/**
 * Encapsulate the web socket we create with methods to use it
 */
export class Realtime {
  private ws: WebSocket | null = null;
  private url = "/api/ws";
  private listeners = new Set<Listener>();
  private reconnectAttemps = 0;
  private heartbeatTimer: number | null = null;
  private heartbeatMs = 25_000;
  private connected = false;
  private manualClose = false;

  /**
   * The constructor defines the url based on the protocol we use (http vs https)
   */
  constructor() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    this.url = `${protocol}://${location.host}${this.url}`;
    console.log(this.url);
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

  ping() {
    this.send({ type: "ping" } as SWOPing);
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
      let msg: AllWsIncoming | null = null;
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : "") as AllWsIncoming;
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
