// src/views/PlayView.ts
import { domElem as h, mount } from "../ui/DomElement";
import { Avatar } from "../ui/Avatar";
import * as http from "../api/http";
import { fetchMyProfile } from "./ProfileView";
import { OnlinePanel, attachNetDriver } from "./PlayOnlineView";
import { Realtime } from "../helpers/ws";

/* ---------------- Dummy users (same vibe as tournaments) ---------------- */
type UserRow = { id: number; pseudo: string; avatar_url: string | null };

type MatchRow = {
  id: number;
  p1_id: number;
  p1_pseudo: string;
  p1_avatar_url: string | null;
  p2_id: number;
  p2_pseudo: string;
  p2_avatar_url: string | null;
  status: "pending" | "finished" | "canceled";
  winner_id: number | null;
  score_p1: number | null;
  score_p2: number | null;
  created_at: string;
};

const stockAvatar = "/user.png";

/* ---------------- Settings types ---------------- */
type Points = 3 | 5 | 7 | 9;
type PaddleSizeKey = "small" | "medium" | "large";
type GameMode = "2d" | "3d";
type Side = "left" | "right";

type Settings = {
  me: UserRow;
  opponent: UserRow | null;
  pointsToWin: Points;
  paddleSize: PaddleSizeKey;
  mySide: Side;
  freeMove: boolean;
  mode: GameMode;
  matchId: number | null;
};

export type PlayPreset = { kind: "duel"; opponent: UserRow; me?: UserRow } | { kind: "tournament"; p1: UserRow; p2: UserRow; pointsToWin?: Points };

let _playPreset: PlayPreset | null = null;

/** Call this before navigating to the Play view. Consumed once on mount. */
export function setPlayPreset(p: PlayPreset) {
  _playPreset = p;
}

/* ---------------- Helpers ---------------- */
const paddleHeights: Record<PaddleSizeKey, number> = { small: 100, medium: 150, large: 200 };
const paddleWidth = 12;
const WORLD_W = 2000;
const WORLD_H = (WORLD_W * 9) / 16;
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

type Rect = { x: number; y: number; width: number; height: number; vx?: number; vy?: number };
type Hit = { hit: false } | { hit: true; nx: number; ny: number; pen: number };

function circleRectHit(cx: number, cy: number, r: number, R: Rect): Hit {
  const qx = clamp(cx, R.x, R.x + R.width);
  const qy = clamp(cy, R.y, R.y + R.height);
  let dx = cx - qx,
    dy = cy - qy;
  const dist2 = dx * dx + dy * dy;

  if (dist2 <= r * r) {
    if (dx === 0 && dy === 0) {
      // circle center exactly on the rectangle surface: pick the shallowest axis
      const l = Math.abs(cx - r - R.x);
      const rgt = Math.abs(R.x + R.width - (cx + r));
      const t = Math.abs(cy - r - R.y);
      const b = Math.abs(R.y + R.height - (cy + r));
      const m = Math.min(l, rgt, t, b);
      if (m === l) return { hit: true, nx: -1, ny: 0, pen: l };
      if (m === rgt) return { hit: true, nx: 1, ny: 0, pen: rgt };
      if (m === t) return { hit: true, nx: 0, ny: -1, pen: t };
      return { hit: true, nx: 0, ny: 1, pen: b };
    }
    const d = Math.sqrt(dist2);
    return { hit: true, nx: dx / d, ny: dy / d, pen: r - d };
  }
  return { hit: false };
}

function resolveAndReflect(
  ball: { x: number; y: number; vx: number; vy: number; radius: number },
  rect: Rect,
  e = 0.9, // restitution
  spin = 0.25, // how much paddle velocity influences the ball
  accel = 1.03 // your speed-up factor
) {
  const h = circleRectHit(ball.x, ball.y, ball.radius, rect);
  if (!h.hit) return false;

  // separate along normal
  ball.x += h.nx * h.pen;
  ball.y += h.ny * h.pen;

  // reflect across contact normal
  const vdotn = ball.vx * h.nx + ball.vy * h.ny;
  ball.vx = ball.vx - (1 + e) * vdotn * h.nx;
  ball.vy = ball.vy - (1 + e) * vdotn * h.ny;

  // add a bit of paddle motion ("english")
  if (rect.vx || rect.vy) {
    ball.vx += (rect.vx ?? 0) * spin;
    ball.vy += (rect.vy ?? 0) * spin;
  }

  // accelerate slightly each hit
  ball.vx *= accel;
  ball.vy *= accel;

  return true;
}

/* =========================================================================
   2D Engine (canvas)
============================================================================ */
class Player2D {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  width = paddleWidth;
  height: number;
  score = 0;
  vx = 0;
  vy = 0; // NEW: instantaneous velocity from last frame
  private _px = 0;
  private _py = 0; // NEW: last position to compute velocity

  // movement flags
  up = false;
  down = false;
  left = false;
  right = false;

  constructor(id: number, name: string, color: string, x: number, y: number, height: number) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.x = x;
    this.y = y;
    this.height = height;
    this._px = this.x;
    this._py = this.y; // NEW
  }

  update(dt: number, canvasW: number, canvasH: number, freeMove: boolean, side: Side) {
    const v = 800;
    const oldX = this.x,
      oldY = this.y; // NEW
    if (this.up) this.y -= v * dt;
    if (this.down) this.y += v * dt;
    if (freeMove) {
      if (this.left) this.x -= v * dt;
      if (this.right) this.x += v * dt;
      // keep inside own half
      const half = canvasW / 2;
      const margin = 10;
      const leftBound = side === "left" ? margin : half + margin;
      const rightBound = side === "left" ? half - margin - this.width : canvasW - margin - this.width;
      this.x = clamp(this.x, leftBound, rightBound);
    }
    // vertical clamp
    this.y = clamp(this.y, 0, canvasH - this.height);

    // NEW: instantaneous velocity (used by ball for spin)
    this.vx = (this.x - oldX) / dt;
    this.vy = (this.y - oldY) / dt;
  }
}

class Ball2D {
  x: number;
  y: number;
  radius = 100;
  vx = 920;
  vy = 350;
  accel = 1.03;
  private lastHitSide: "L" | "R" | null = null; // which paddle hit last
  private sinceLastHitMs = 1e9; // time since last paddle hit
  private samePaddleCooldownMs = 1000; // tweak: 80–150ms feels good

  private img: HTMLImageElement | null = null;
  private imgReady = false;
  private angle = 0;
  private spinFactor = 1;

  constructor(x: number, y: number, radius = 100, imgSrc?: string) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    if (imgSrc) this.loadImage(imgSrc);
  }

  // Optional late binding of the sprite*/
  setImage(src: string) {
    this.loadImage(src);
  }

  private loadImage(src: string) {
    const img = new Image();
    img.crossOrigin = "anonymous"; // safe no-op for local /public
    img.src = src;
    img.onload = () => {
      this.img = img;
      this.imgReady = true;
    };
  }

  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() > 0.5 ? 1 : -1) * 500;
    this.vy = (Math.random() > 0.5 ? 1 : -1) * 320;
    this.lastHitSide = null; // NEW
    this.sinceLastHitMs = 1e9; // NEW
    // keep the current angle so the spin feels continuous;
    // set this.angle = 0 if you want a fresh spin each serve
  }

  /** Physics + collisions; returns scorer (1 or 2) or null */
  step(
    dt: number,
    cw: number,
    ch: number,
    pL: { x: number; y: number; width: number; height: number; vx?: number; vy?: number },
    pR: { x: number; y: number; width: number; height: number; vx?: number; vy?: number }
  ): 1 | 2 | null {
    // integrate
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // NEW: advance cooldown timer
    this.sinceLastHitMs += dt * 1000;

    // spin proportional to speed & size
    const speed = Math.hypot(this.vx, this.vy);
    this.angle += (speed / (this.radius * 8)) * dt * this.spinFactor;

    // walls (top/bottom) with proper separation
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy *= -1;
    }
    if (this.y + this.radius > ch) {
      this.y = ch - this.radius;
      this.vy *= -1;
    }

    // collide with paddles using normal-based reflection (one hit max per frame)
    let hit = false;

    // allow Left if last hit wasn't Left, or cooldown elapsed
    if (this.lastHitSide !== "L" || this.sinceLastHitMs >= this.samePaddleCooldownMs) {
      if (resolveAndReflect(this, pL, 0.9, 0.25, this.accel)) {
        this.lastHitSide = "L";
        this.sinceLastHitMs = 0;
        hit = true;
      }
    }

    // only try Right if we didn't already collide this frame
    if (!hit && (this.lastHitSide !== "R" || this.sinceLastHitMs >= this.samePaddleCooldownMs)) {
      if (resolveAndReflect(this, pR, 0.9, 0.25, this.accel)) {
        this.lastHitSide = "R";
        this.sinceLastHitMs = 0;
        hit = true;
      }
    }

    // scoring (leave-side only)
    if (this.x < 0) {
      this.lastHitSide = null;
      this.sinceLastHitMs = 1e9;
      return 2;
    }
    if (this.x > cw) {
      this.lastHitSide = null;
      this.sinceLastHitMs = 1e9;
      return 1;
    }
    return null;
  }

  /** Draws the ball (sprite if loaded; circle fallback otherwise) */
  draw(ctx: CanvasRenderingContext2D) {
    if (this.imgReady && this.img) {
      const size = this.radius * 2;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.imageSmoothingEnabled = true; // set false for crisp pixel-art icons
      ctx.drawImage(this.img, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export class Game2D {
  private dpr = window.devicePixelRatio || 1;
  private scale = 1;
  private ctx: CanvasRenderingContext2D;
  private pLeft: Player2D;
  private pRight: Player2D;
  private ball: Ball2D;
  paused = true;
  private over = false;
  private winner: Player2D | null = null;
  private last = 0;
  private freeMove: boolean;
  private target: number;
  private keyListener!: (e: KeyboardEvent) => void;
  private keyUpListener!: (e: KeyboardEvent) => void;
  private resizeObs!: ResizeObserver;
  private header: HTMLElement;
  private matchId: number;
  private netMode = false;
  private countdown: number | null = null;
  private lastPauseToggleAt = 0;
  private pauseCooldownMs = 700;

  // controls mapping
  private leftKeys = { up: "z", down: "s", left: "q", right: "d" };
  private rightKeys = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

  constructor(private wrap: HTMLElement, private canvas: HTMLCanvasElement, header: HTMLElement, me: UserRow, opp: UserRow, mySide: Side, paddleH: number, pointsToWin: number, freeMove: boolean) {
    this.header = header;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context failed");
    this.ctx = ctx;

    // place paddles by side
    const margin = 18;
    const midY = (WORLD_H - paddleH) / 2;

    const meLeft = mySide === "left";
    const leftId = meLeft ? me.id : opp.id;
    const rightId = meLeft ? opp.id : me.id;
    const leftName = meLeft ? me.pseudo : opp.pseudo;
    const rightName = meLeft ? opp.pseudo : me.pseudo;

    this.pLeft = new Player2D(leftId, leftName, "#e2f7e1", margin, midY, paddleH);
    this.pRight = new Player2D(rightId, rightName, "#fde2e2", WORLD_W - margin - paddleWidth, midY, paddleH);
    this.ball = new Ball2D(WORLD_W / 2, WORLD_H / 2, 40, "/ball.png");

    this.freeMove = freeMove;
    this.target = pointsToWin;
    this.matchId = -1;

    this.installKeys(meLeft ? "left" : "right");
    this.installResize();
  }

  enableNetMode() {
    this.netMode = true;
  }

  setCountdown(sec: number | null) {
    this.countdown = sec;
  }

  applyAuthoritative(state: {
    ball: { x: number; y: number; vx: number; vy: number };
    left: { x: number; y: number; vx: number; vy: number; score: number; id: number; name: string };
    right: { x: number; y: number; vx: number; vy: number; score: number; id: number; name: string };
    target: number;
    freeMove: boolean;
    paddleH: number;
  }) {
    this.ball.x = state.ball.x;
    this.ball.y = state.ball.y;
    this.ball.vx = state.ball.vx;
    this.ball.vy = state.ball.vy;
    this.pLeft.x = state.left.x;
    this.pLeft.y = state.left.y;
    this.pLeft.vx = state.left.vx;
    this.pLeft.vy = state.left.vy;
    this.pLeft.score = state.left.score;
    this.pRight.x = state.right.x;
    this.pRight.y = state.right.y;
    this.pRight.vx = state.right.vx;
    this.pRight.vy = state.right.vy;
    this.pRight.score = state.right.score;
    this.target = state.target;
    this.freeMove = state.freeMove;
  }

  private onLocalKey?: (key: "up" | "down" | "left" | "right", pressed: boolean) => void;

  setKeyForwarder(fn: (key: "up" | "down" | "left" | "right", pressed: boolean) => void) {
    this.onLocalKey = fn;
  }

  private installResize() {
    const fit = () => {
      // how big can we display the world in CSS pixels?
      const availW = this.wrap.clientWidth;
      const availH = this.wrap.clientHeight - this.header.clientHeight - 12;
      const scale = Math.min(availW / WORLD_W, availH / WORLD_H);
      // avoid too tiny
      this.scale = Math.max(scale, 0.5);

      // CSS display size
      const cssW = Math.floor(WORLD_W * this.scale);
      const cssH = Math.floor(WORLD_H * this.scale);
      this.canvas.style.width = cssW + "px";
      this.canvas.style.height = cssH + "px";

      // backing store size (physical pixels)
      const pxW = Math.floor(cssW * this.dpr);
      const pxH = Math.floor(cssH * this.dpr);
      if (this.canvas.width !== pxW || this.canvas.height !== pxH) {
        this.canvas.width = pxW;
        this.canvas.height = pxH;
      }
    };
    fit();
    this.resizeObs = new ResizeObserver(fit);
    this.resizeObs.observe(this.wrap);
  }

  private installKeys(meControlSide: "left" | "right") {
    // const meMap = meControlSide === "left" ? this.leftKeys : this.rightKeys;
    // const oppMap = meControlSide === "left" ? this.rightKeys : this.leftKeys;

    this.keyListener = (e: KeyboardEvent) => {
      if (e.key === " " && !e.repeat) {
        const now = performance.now();
        if (now - this.lastPauseToggleAt >= this.pauseCooldownMs) {
          this.lastPauseToggleAt = now;
          if (this.netMode) {
            // Defer to server : it wil emit countdown / pause states
            this.onLocalPause?.();
          } else {
            // Local: immediate toggle + 3s countdown when unpausing
            if (this.over) {
              this.resetRound();
              this.over = false;
            }
            const goingToPaused = !this.paused;
            this.paused = goingToPaused;
            if (!goingToPaused) {
              this.countdown = 3;

              const timer = setInterval(() => {
                if (this.countdown! > 1) this.countdown!--;
                else {
                  this.countdown = null;
                  clearInterval(timer);
                }
              }, 1000);
            }
          }
        }
      }

      // Translate to logical keys
      const keyMap: Record<string, ("up" | "down" | "left" | "right") | null> = {
        [this.leftKeys.up]: "up",
        [this.leftKeys.down]: "down",
        [this.leftKeys.left]: "left",
        [this.leftKeys.right]: "right",
        [this.rightKeys.up]: "up",
        [this.rightKeys.down]: "down",
        [this.rightKeys.left]: "left",
        [this.rightKeys.right]: "right",
      };
      const logical = keyMap[e.key] ?? null;
      if (logical) {
        if (this.netMode) {
          this.onLocalKey?.(logical, true);
        } else {
          // left paddle
          if (e.key === this.leftKeys.up) this.pLeft.up = true;
          if (e.key === this.leftKeys.down) this.pLeft.down = true;
          if (e.key === this.leftKeys.left) this.pLeft.left = true;
          if (e.key === this.leftKeys.right) this.pLeft.right = true;
          // right paddle
          if (e.key === this.rightKeys.up) this.pRight.up = true;
          if (e.key === this.rightKeys.down) this.pRight.down = true;
          if (e.key === this.rightKeys.left) this.pRight.left = true;
          if (e.key === this.rightKeys.right) this.pRight.right = true;
        }
      }

      // prevent page scroll on space/arrow
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    };
    this.keyUpListener = (e: KeyboardEvent) => {
      const keyMap: Record<string, ("up" | "down" | "left" | "right") | null> = {
        [this.leftKeys.up]: "up",
        [this.leftKeys.down]: "down",
        [this.leftKeys.left]: "left",
        [this.leftKeys.right]: "right",
        [this.rightKeys.up]: "up",
        [this.rightKeys.down]: "down",
        [this.rightKeys.left]: "left",
        [this.rightKeys.right]: "right",
      };
      const logical = keyMap[e.key] ?? null;
      if (logical) {
        if (this.netMode) {
          this.onLocalKey?.(logical, false);
        } else {
          if (e.key === this.leftKeys.up) this.pLeft.up = false;
          if (e.key === this.leftKeys.down) this.pLeft.down = false;
          if (e.key === this.leftKeys.left) this.pLeft.left = false;
          if (e.key === this.leftKeys.right) this.pLeft.right = false;

          if (e.key === this.rightKeys.up) this.pRight.up = false;
          if (e.key === this.rightKeys.down) this.pRight.down = false;
          if (e.key === this.rightKeys.left) this.pRight.left = false;
          if (e.key === this.rightKeys.right) this.pRight.right = false;
        }
      }
    };

    window.addEventListener("keydown", this.keyListener, { passive: false });
    window.addEventListener("keyup", this.keyUpListener, { passive: false });
  }

  dispose() {
    window.removeEventListener("keydown", this.keyListener);
    window.removeEventListener("keyup", this.keyUpListener);
    this.resizeObs?.disconnect();
  }

  async resetRound() {
    const matchData: MatchRow = await http.postRequest<MatchRow>("/api/matches", { meId: this.pLeft.id, oppId: this.pRight.id });
    this.matchId = matchData.id;
    this.pLeft.score = 0;
    this.pRight.score = 0;
    this.ball.reset(WORLD_W / 2, WORLD_H / 2); // was canvas.width/height
  }

  async start() {
    const matchData: MatchRow = await http.postRequest<MatchRow>("/api/matches", { meId: this.pLeft.id, oppId: this.pRight.id });
    this.matchId = matchData.id;
    this.last = performance.now();
    const tick = (t: number) => {
      const dt = (t - this.last) / 1000;
      this.last = t;
      if (!this.paused && !this.netMode) this.update(dt); // Local sim only
      this.draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private async update(dt: number) {
    const maxStep = 1 / 240; // 240 Hz substeps
    let remaining = dt;
    while (remaining > 0) {
      const s = Math.min(maxStep, remaining);

      // move paddles in the same substep cadence (so their vx/vy are accurate)
      this.pLeft.update(s, WORLD_W, WORLD_H, this.freeMove, "left");
      this.pRight.update(s, WORLD_W, WORLD_H, this.freeMove, "right");

      const scorer = this.ball.step(s, WORLD_W, WORLD_H, this.pLeft, this.pRight);
      if (scorer) {
        (scorer === 1 ? this.pLeft : this.pRight).score++;
        if (this.pLeft.score >= this.target || this.pRight.score >= this.target) {
          this.winner = this.pLeft.score > this.pRight.score ? this.pLeft : this.pRight;
          this.over = true;
          await http.putRequest(`/api/matches/${this.matchId}/result`, { scoreP1: this.pLeft.score, scoreP2: this.pRight.score });
        }
        this.ball.reset(WORLD_W / 2, WORLD_H / 2); // CHANGED: world space
        this.paused = true;
        break; // stop consuming the rest of dt this frame
      }

      remaining -= s;
    }
  }

  private drawField(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // greenish gradient background
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#162322");
    g.addColorStop(1, "#2e736c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // field border
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // center dashed line
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 10);
    ctx.lineTo(w / 2, h - 10);
    ctx.stroke();
    ctx.restore();

    // center circle
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.1, 0, Math.PI * 2);
    ctx.stroke();
  }

  private draw() {
    const ctx = this.ctx;

    // Reset and set transform for crisp scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0);

    // draw using WORLD units
    this.drawField(ctx, WORLD_W, WORLD_H);
    this.ball.draw(ctx); // your Ball2D already draws at (x,y) with radius in world units
    ctx.fillStyle = this.pLeft.color;
    ctx.fillRect(this.pLeft.x, this.pLeft.y, this.pLeft.width, this.pLeft.height);
    ctx.fillStyle = this.pRight.color;
    ctx.fillRect(this.pRight.x, this.pRight.y, this.pRight.width, this.pRight.height);

    if (this.paused || this.countdown) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "100px system-ui, sans-serif";
      ctx.textAlign = "center";
      const msg = this.countdown ? String(this.countdown) : this.over ? `Winner: ${this.winner?.name ?? ""}` : "Paused";
      ctx.fillText(msg, WORLD_W / 2, WORLD_H * 0.25);
    }
  }

  private onLocalPause?: () => void;

  setPauseForwarder(fn: () => void) {
    this.onLocalPause = fn;
  }

  getScores() {
    return { left: this.pLeft.score, right: this.pRight.score };
  }
  isOver() {
    return this.over;
  }
  getWinnerName() {
    return this.winner?.name ?? null;
  }
}

/* =========================================================================
   Settings Panel (search opponent, knobs, preview)
============================================================================ */
async function SettingsPanel(prefill: Partial<Settings> | null, onStart: (s: Settings) => void) {
  const myProfile = await fetchMyProfile();

  const state: Settings = {
    me: { id: myProfile.id, pseudo: myProfile.pseudo, avatar_url: myProfile.avatarUrl },
    opponent: null,
    pointsToWin: 3,
    paddleSize: "medium",
    mySide: "left",
    freeMove: false,
    mode: "2d",
    matchId: null,
  };

  // Apply prefill if provided
  if (prefill) {
    state.me = prefill.me ?? state.me;
    state.opponent = prefill.opponent ?? state.opponent;
    state.pointsToWin = prefill.pointsToWin ?? state.pointsToWin;
    state.paddleSize = prefill.paddleSize ?? state.paddleSize;
    state.mySide = prefill.mySide ?? state.mySide;
    state.freeMove = prefill.freeMove ?? state.freeMove;
    state.mode = prefill.mode ?? state.mode;
  }

  const panel = h("div", { class: "w-full grid md:grid-cols-2 gap-6 bg-white rounded-2xl border border-emerald-100 shadow" });

  // LEFT: opponent search
  const users: UserRow[] = (await http.getRequest<UserRow[]>("/api/users/all")).filter((u) => u.id !== state.me.id);

  const left = h("div", { class: "flex flex-col gap-3 p-6" });
  left.append(h("div", { class: "text-lg font-semibold text-emerald-900", text: "Choose opponent" }));
  const search = h("input", {
    class: "px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
    attributes: { placeholder: "Search users…", type: "search" },
  }) as HTMLInputElement;
  const results = h("div", { class: "max-h-130 overflow-auto space-y-1" });

  function row(u: UserRow) {
    const picked = state.opponent?.id === u.id;
    const btn = h("button", {
      class: "w-full flex items-center gap-3 px-3 py-2 rounded-xl " + (picked ? "bg-emerald-200/60" : "hover:bg-emerald-100/60"),
      attributes: { type: "button" },
    });
    btn.append(Avatar(u.avatar_url ?? stockAvatar, 28), h("div", { class: "font-medium text-emerald-900 truncate", text: u.pseudo }));
    btn.addEventListener("click", () => {
      state.opponent = u;
      renderResults(users);
      if (state.mySide === "left") {
        rightSidePlayer.textContent = state.opponent?.pseudo ?? "Opponent";
      } else {
        leftSidePlayer.textContent = state.opponent?.pseudo ?? "Opponent";
      }
    });
    return btn;
  }

  const startBtn = h("button", {
    class: "mt-1 px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40",
    attributes: { type: "button", disabled: "true" },
    text: "Start match",
  });

  const canStart = () => {
    const ok = !!state.opponent;
    startBtn.toggleAttribute("disabled", !ok);
  };

  function renderResults(users: UserRow[]) {
    results.replaceChildren();
    const q = search.value.trim().toLowerCase();

    // Base list + ensure prefilled opponent is present at the top
    const base: UserRow[] = users.slice();
    if (state.opponent && !base.some((u) => u.id === state.opponent!.id)) {
      base.unshift(state.opponent);
    }

    const list = q ? base.filter((x) => x.pseudo.toLowerCase().includes(q) && x.id != state.me.id) : base;
    list.forEach((u) => results.append(row(u)));

    // Make sure the Start button reflects current state
    canStart();
  }

  search.addEventListener("input", () => renderResults(users));
  renderResults(users);

  left.append(search, results);

  // RIGHT: settings
  const right = h("div", { class: "flex flex-col gap-7 p-6 items-center bg-emerald-50" });
  right.append(h("div", { class: "text-lg font-semibold text-slate-800", text: "Match settings" }));

  const rightWrap = h("div", { class: "flex flex-col gap-4 items-center" });

  right.append(rightWrap);

  // Points
  const pointsWrap = h("div", { class: "flex flex-col items-center gap-4" });
  pointsWrap.append(h("div", { class: "text-sm font-semibold text-slate-600", text: "Points to win" }));
  const points = h("div", { class: "flex flex-wrap gap-2" });
  ([3, 5, 7, 9] as Points[]).forEach((p) => {
    const b = h("button", {
      class: "px-3 py-2 rounded-xl border " + (state.pointsToWin === p ? "bg-emerald-700 text-white border-emerald-600" : "border-slate-200 hover:bg-emerald-400 hover:text-white"),
      attributes: { type: "button" },
      text: `${p} points`,
    });
    b.addEventListener("click", () => {
      state.pointsToWin = p;
      // refresh buttons
      points.querySelectorAll("button").forEach((x) => (x.className = x.className.replace(/bg-emerald-700.*|border-emerald-600/g, "border-slate-200")));
      b.className = "px-3 py-2 rounded-xl border bg-emerald-700 text-white border-emerald-600";
    });
    points.appendChild(b);
  });
  pointsWrap.append(points);
  rightWrap.append(pointsWrap);
  rightWrap.append(h("div", { class: "h-0.25 w-[60%] my-2 bg-emerald-700/20" }));

  // Paddle size + preview
  const paddleWrap = h("div", { class: "flex flex-col items-center gap-4" });
  paddleWrap.append(h("div", { class: "text-sm  font-semibold text-slate-600", text: "Paddle" }));
  const sizes = h("div", { class: "flex flex-wrap gap-10" });
  (["small", "medium", "large"] as PaddleSizeKey[]).forEach((k) => {
    const box = h("button", {
      class: "px-2 py-2 rounded-xl border border-slate-200 hover:bg-emerald-400 flex items-end gap-2",
      attributes: { type: "button", title: k },
    });
    const bar = h("div", { class: "w-3 bg-emerald-700 rounded" });
    (bar as HTMLElement).style.height = `${paddleHeights[k] / 3}px`;
    const label = h("div", { class: "text-xs text-slate-600 capitalize", text: k });
    box.append(bar, label);
    box.addEventListener("click", () => {
      state.paddleSize = k;
      sizes.querySelectorAll("button").forEach((x) => x.classList.remove("ring-2", "ring-emerald-300"));
      box.classList.add("ring-2", "ring-emerald-300");
    });
    if (k === state.paddleSize) box.classList.add("ring-2", "ring-emerald-300");
    sizes.append(box);
  });
  paddleWrap.append(sizes);

  // Free move toggle
  const freeWrap = h("label", { class: "inline-flex items-center gap-3 cursor-pointer" });
  const freeChk = h("input", { attributes: { type: "checkbox" }, class: "w-4 h-4 accent-emerald-600" }) as HTMLInputElement;
  const freeLbl = h("span", { class: "text-sm text-slate-700", text: "Allow free movement (all directions)" });
  freeChk.checked = state.freeMove;
  freeChk.addEventListener("change", () => {
    state.freeMove = freeChk.checked;
  });
  freeWrap.append(freeChk, freeLbl);
  paddleWrap.append(freeWrap);

  rightWrap.append(paddleWrap);
  rightWrap.append(h("div", { class: "h-0.25 w-[60%] my-2 bg-emerald-700/20" }));

  // Side selector
  const sideWrap = h("div", { class: "w-full flex flex-col items-center gap-3" });
  sideWrap.append(h("div", { class: "text-sm font-semibold text-slate-600", text: "Side" }));

  const sides = h("div", { class: "w-full flex flex-row items-center justify-around" });
  const leftSidePlayer = h("div", { class: "w-20 flex-none", text: state.me.pseudo });
  const rightSidePlayer = h("div", { class: "w-20 flex-none", text: state.opponent?.pseudo ?? "Opponent" });

  const sideBtn = h("button", {
    class: "px-3 py-2 rounded-xl bg-emerald-700 text-white border border-slate-200 hover:bg-emerald-400 flex items-center gap-2",
    attributes: { type: "button" },
  });
  const sideIcon = h("i", { class: "fa-solid fa-right-left" });
  sideBtn.append(sideIcon);
  sideBtn.addEventListener("click", () => {
    if (state.mySide === "left") {
      state.mySide = "right";
      leftSidePlayer.textContent = state.opponent?.pseudo ?? "Opponent";
      rightSidePlayer.textContent = state.me.pseudo;
    } else {
      state.mySide = "left";
      leftSidePlayer.textContent = state.me.pseudo;
      rightSidePlayer.textContent = state.opponent?.pseudo ?? "Opponent";
    }
  });
  sides.append(leftSidePlayer, sideBtn, rightSidePlayer);
  sideWrap.append(sides);
  rightWrap.append(sideWrap);
  rightWrap.append(h("div", { class: "h-0.25 w-[60%] my-2 bg-emerald-700/20" }));

  // Mode
  const modeWrap = h("div", { class: "flex flex-col items-center gap-3" });
  modeWrap.append(h("div", { class: "text-sm  font-semibold text-slate-600", text: "Mode" }));
  const modes = h("div", { class: "flex flex-wrap gap-2" });
  const mode2d = h("button", { class: "px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50", attributes: { type: "button" }, text: "2D" });
  const mode3d = h("button", { class: "px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50", attributes: { type: "button" }, text: "3D" });
  modes.append(mode2d, mode3d);

  const summary = h("div", { class: "text-sm text-slate-600 pt-1" });

  // Summary + Start

  const observeOpponent = new MutationObserver(canStart);
  observeOpponent.observe(results, { childList: true, subtree: true });
  // simpler: also run after every render
  const t = setInterval(canStart, 300);

  startBtn.addEventListener("click", async () => {
    clearInterval(t);
    observeOpponent.disconnect();
    onStart({ ...state });
  });

  right.append(summary, startBtn);

  mount(panel, left, right);

  const backBtn = h("button", { class: "bg-emerald-600 text-white ", text: "Back :)" });

  canStart(); // <-- add this line so Start enables if opponent is prefilled

  return { el: panel };
}

/* =========================================================================
   Header
============================================================================ */
function MatchHeader(me: UserRow, opp: UserRow, mySide: Side, getScores: () => { left: number; right: number }) {
  const bar = h("div", { class: "h-16 px-4 border-b border-emerald-100 bg-emerald-50/70 flex items-center justify-between" });

  const leftBox = h("div", { class: "flex items-center gap-3" });
  const rightBox = h("div", { class: "flex items-center gap-3" });

  const meLeft = mySide === "left";
  const L = meLeft ? me : opp;
  const R = meLeft ? opp : me;

  const lScore = h("div", { class: "px-3 py-1 rounded-lg bg-white text-emerald-700 font-semibold min-w-10 text-center", text: "0" });
  const rScore = h("div", { class: "px-3 py-1 rounded-lg bg-white text-emerald-700 font-semibold min-w-10 text-center", text: "0" });

  leftBox.append(Avatar(L.avatar_url ?? stockAvatar, 32), h("div", { class: "font-semibold text-emerald-900", text: L.pseudo }), lScore);
  rightBox.append(rScore, h("div", { class: "font-semibold text-emerald-900", text: R.pseudo }), Avatar(R.avatar_url ?? stockAvatar, 32));

  bar.append(leftBox, rightBox);

  function update() {
    const s = getScores();
    lScore.textContent = String(s.left);
    rScore.textContent = String(s.right);
  }
  return { el: bar, update };
}

/* =========================================================================
   Match Views
============================================================================ */
function GameView2D(root: HTMLElement, me: UserRow, opp: UserRow, settings: Settings) {
  const wrap = h("div", { class: "flex-1 min-h-0 grid place-items-center bg-emerald-50" }); // inside AppShell padding
  const canvas = h("canvas", {
    class: "block rounded-md shadow border border-emerald-100 bg-white",
  }) as HTMLCanvasElement;

  const header = MatchHeader(me, opp, settings.mySide, () => game.getScores());
  mount(root, header.el, mount(wrap, canvas));

  const game = new Game2D(wrap, canvas, header.el, me, opp, settings.mySide, paddleHeights[settings.paddleSize], settings.pointsToWin, settings.freeMove);
  game.start();

  // scores ticker
  const raf = () => {
    header.update();
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  return () => game.dispose();
}

function GameView2DNet(root: HTMLElement, me: UserRow, opp: UserRow, mySide: Side, settings: Settings, ws: Realtime, matchId: number) {
  const wrap = h("div", { class: "flex-1 min-h-0 grid place-items-center bg-emerald-50" });
  const canvas = h("canvas", { class: "block rounded-md shadow border border-emerald-100 bg-white" }) as HTMLCanvasElement;
  const header = MatchHeader(me, opp, mySide, () => game.getScores());
  mount(root, header.el, mount(wrap, canvas));

  const game = new Game2D(wrap, canvas, header.el, me, opp, mySide, paddleHeights[settings.paddleSize], settings.pointsToWin, settings.freeMove);
  const detach = attachNetDriver(game, ws, matchId, mySide);
  game.start();

  const raf = () => {
    header.update();
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  return () => {
    detach();
    game.dispose();
  };
}

/* =========================================================================
   Main exported view
============================================================================ */
export async function PlayView(root: HTMLElement) {
  const holder = h("div", { class: "flex flex-col gap-2" });
  root.replaceChildren(holder);

  const meProfile = await fetchMyProfile();
  const me: UserRow = { id: meProfile.id, pseudo: meProfile.pseudo, avatar_url: meProfile.avatarUrl };

  const ws = new Realtime("/api/ws");
  ws.connect();

  function mountLocalFlow() {
    holder.replaceChildren();
    SettingsPanel(null, (s) => {
      holder.replaceChildren();
      const unmount = GameView2D(holder, s.me, s.opponent!, s);
      const backBar = h("div", { class: "mt-3 flex justify-center" });
      const back = h("button", {
        class: "px-3 py-2 rounded-md text-white bg-rose-600 hover:bg-rose-500",
        attributes: {
          type: "button",
        },
        text: "Cancel Match",
      });
      back.addEventListener("click", () => {
        unmount?.();
        mountChooser();
      });
      backBar.append(back);
    }).then((settings) => holder.append(settings.el));
  }

  function mountOnlineFlow() {
    holder.replaceChildren();
    const online = OnlinePanel({
      me,
      ws,
      onMatchStart: (matchId, wireSettings, role) => {
        const mySide: Side = wireSettings.hostSide === "left" ? (role === "host" ? "left" : "right") : role === "host" ? "right" : "left";
        const opp = onlineOppGuess();
        holder.replaceChildren();
        const s: Settings = {
          me,
          opponent: opp!,
          pointsToWin: wireSettings.pointsToWin,
          paddleSize: wireSettings.paddleSize,
          mySide,
          freeMove: wireSettings.freeMove,
          mode: "2d",
          matchId,
        };
        const unmount = GameView2DNet(holder, me, opp!, mySide, s, ws, matchId);

        const backBar = h("div", { class: "mt-3 flex justify-center" });
        const back = h("button", {
          class: "px-3 py-2 rounded-md text-white bg-rose-600 hover:bg-rose-500",
          attributes: {
            type: "button",
          },
          text: "Leave Match",
        });
        back.addEventListener("click", () => {
          ws.unsubscribeMatch(matchId);
          unmount?.();
          mountChooser();
        });
        backBar.append(back);
        holder.append(backBar);
      },
    });
    holder.append(online.wrap);
  }

  function mountChooser() {
    const chooser = OpeningChooser((kind) => {
      if (kind === "local") mountLocalFlow();
      else mountOnlineFlow();
    });
    holder.replaceChildren(chooser);
  }

  mountChooser();
  return () => {
    ws.close();
  };
}
