// src/views/PlayView.ts
import type { View } from "./AppShell";
import { domElem as h, mount } from "../ui/DomElement";
import { Avatar } from "../ui/Avatar";

/**
 * PlayView: settings panel → 2D or 3D match view
 * - Search an opponent from a dummy user list
 * - Points to win (3/5/7/9)
 * - Paddle size with preview
 * - Pick your side (left/right)
 * - Free-move paddles (all directions) toggle
 * - 2D vs 3D mode; same logic, different rendering
 *
 * Babylon is lazy-loaded ONLY if 3D is chosen (install @babylonjs/core to use it).
 */

/* ---------------- Dummy users (same vibe as tournaments) ---------------- */
type Id = number;
type User = { id: Id; alias: string; avatar: string | null };

const stockAvatar = "/user.png";
function stableId(str: string) {
  let s = 0;
  for (let i = 0; i < str.length; i++) s = ((s << 5) - s + str.charCodeAt(i)) | 0;
  return Math.abs(s) + 1000;
}
function makeUser(alias: string): User {
  return { id: stableId(alias), alias, avatar: stockAvatar };
}
const allUsers: User[] = [
  "Ada Lovelace",
  "Alan Turing",
  "Grace Hopper",
  "Hedy Lamarr",
  "Barbara Liskov",
  "Edsger Dijkstra",
  "Donald Knuth",
  "Linus Torvalds",
  "Ken Thompson",
  "Dennis Ritchie",
  "Margaret Hamilton",
  "John Von Neumann",
].map(makeUser);

/* ---------------- Settings types ---------------- */
type Points = 3 | 5 | 7 | 9;
type PaddleSizeKey = "small" | "medium" | "large";
type GameMode = "2d" | "3d";
type Side = "left" | "right";

type Settings = {
  me: User;
  opponent: User | null;
  pointsToWin: Points;
  paddleSize: PaddleSizeKey;
  mySide: Side;
  freeMove: boolean;
  mode: GameMode;
};

export type PlayPreset = { kind: "duel"; opponent: User; me?: User } | { kind: "tournament"; p1: User; p2: User; pointsToWin?: Points };

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

  constructor(name: string, color: string, x: number, y: number, height: number) {
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

class Game2D {
  private dpr = window.devicePixelRatio || 1;
  private scale = 1;
  private ctx: CanvasRenderingContext2D;
  private pLeft: Player2D;
  private pRight: Player2D;
  private ball: Ball2D;
  private paused = true;
  private over = false;
  private winner: Player2D | null = null;
  private last = 0;
  private freeMove: boolean;
  private target: number;
  private keyListener!: (e: KeyboardEvent) => void;
  private keyUpListener!: (e: KeyboardEvent) => void;
  private resizeObs!: ResizeObserver;
  private header: HTMLElement;

  // controls mapping
  private leftKeys = { up: "z", down: "s", left: "q", right: "d" };
  private rightKeys = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

  constructor(private wrap: HTMLElement, private canvas: HTMLCanvasElement, header: HTMLElement, me: User, opp: User, mySide: Side, paddleH: number, pointsToWin: number, freeMove: boolean) {
    this.header = header;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context failed");
    this.ctx = ctx;

    // place paddles by side
    const margin = 18;
    const midY = (WORLD_H - paddleH) / 2;

    const meLeft = mySide === "left";
    const leftName = meLeft ? me.alias : opp.alias;
    const rightName = meLeft ? opp.alias : me.alias;

    this.pLeft = new Player2D(leftName, "#e2f7e1", margin, midY, paddleH);
    this.pRight = new Player2D(rightName, "#fde2e2", WORLD_W - margin - paddleWidth, midY, paddleH);
    this.ball = new Ball2D(WORLD_W / 2, WORLD_H / 2, 40, "/ball.png");

    this.freeMove = freeMove;
    this.target = pointsToWin;

    this.installKeys(meLeft ? "left" : "right");
    this.installResize();
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
    const meMap = meControlSide === "left" ? this.leftKeys : this.rightKeys;
    const oppMap = meControlSide === "left" ? this.rightKeys : this.leftKeys;

    this.keyListener = (e: KeyboardEvent) => {
      if (e.key === " " && !e.repeat) {
        if (this.over) {
          this.resetRound();
          this.over = false;
        }
        this.paused = !this.paused;
      }
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

      // prevent page scroll on space/arrow
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    };
    this.keyUpListener = (e: KeyboardEvent) => {
      if (e.key === this.leftKeys.up) this.pLeft.up = false;
      if (e.key === this.leftKeys.down) this.pLeft.down = false;
      if (e.key === this.leftKeys.left) this.pLeft.left = false;
      if (e.key === this.leftKeys.right) this.pLeft.right = false;

      if (e.key === this.rightKeys.up) this.pRight.up = false;
      if (e.key === this.rightKeys.down) this.pRight.down = false;
      if (e.key === this.rightKeys.left) this.pRight.left = false;
      if (e.key === this.rightKeys.right) this.pRight.right = false;
    };

    window.addEventListener("keydown", this.keyListener, { passive: false });
    window.addEventListener("keyup", this.keyUpListener, { passive: false });
  }

  dispose() {
    window.removeEventListener("keydown", this.keyListener);
    window.removeEventListener("keyup", this.keyUpListener);
    this.resizeObs?.disconnect();
  }

  resetRound() {
    this.pLeft.score = 0;
    this.pRight.score = 0;
    this.ball.reset(WORLD_W / 2, WORLD_H / 2); // was canvas.width/height
  }

  start() {
    this.last = performance.now();
    const tick = (t: number) => {
      const dt = (t - this.last) / 1000;
      this.last = t;
      if (!this.paused) this.update(dt);
      this.draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private update(dt: number) {
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

    if (this.paused) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "100px system-ui, sans-serif";
      ctx.textAlign = "center";
      const msg = this.over ? `Winner: ${this.winner?.name ?? ""}` : "Press Space to resume";
      ctx.fillText(msg, WORLD_W / 2, WORLD_H * 0.25);
    }
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
function SettingsPanel(prefill: Partial<Settings> | null, onStart: (s: Settings) => void) {
  const state: Settings = {
    me: { id: 1, alias: "Quentichou", avatar: stockAvatar },
    opponent: null,
    pointsToWin: 3,
    paddleSize: "medium",
    mySide: "left",
    freeMove: false,
    mode: "2d",
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

  const wrap = h("div", { class: "w-full grid md:grid-cols-2 gap-6 bg-white rounded-2xl border border-emerald-100 shadow" });

  // LEFT: opponent search
  const left = h("div", { class: "flex flex-col gap-3 p-6" });
  left.append(h("div", { class: "text-lg font-semibold text-emerald-900", text: "Choose opponent" }));
  const search = h("input", {
    class: "px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
    attributes: { placeholder: "Search users…", type: "search" },
  }) as HTMLInputElement;
  const results = h("div", { class: "overflow-auto space-y-1" });

  function row(u: User) {
    const picked = state.opponent?.id === u.id;
    const btn = h("button", {
      class: "w-full flex items-center gap-3 px-3 py-2 rounded-xl " + (picked ? "bg-emerald-200/60" : "hover:bg-emerald-100/60"),
      attributes: { type: "button" },
    });
    btn.append(Avatar(u.avatar, 28), h("div", { class: "font-medium text-emerald-900 truncate", text: u.alias }));
    btn.addEventListener("click", () => {
      state.opponent = u;
      renderResults();
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

  function renderResults() {
    results.replaceChildren();
    const q = search.value.trim().toLowerCase();

    // Base list + ensure prefilled opponent is present at the top
    const base: User[] = allUsers.slice();
    if (state.opponent && !base.some((u) => u.id === state.opponent!.id)) {
      base.unshift(state.opponent);
    }

    const list = q ? base.filter((x) => x.alias.toLowerCase().includes(q)) : base.slice(0, 8);
    list.forEach((u) => results.append(row(u)));

    // Make sure the Start button reflects current state
    canStart();
  }

  search.addEventListener("input", renderResults);
  renderResults();

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
  const leftSidePlayer = h("div", { class: "w-20 flex-none", text: state.me.alias });
  const rightSidePlayer = h("div", { class: "w-20 flex-none", text: state.opponent?.alias ?? "Opponent" });

  const sideBtn = h("button", {
    class: "px-3 py-2 rounded-xl bg-emerald-700 text-white border border-slate-200 hover:bg-emerald-400 flex items-center gap-2",
    attributes: { type: "button" },
  });
  const sideIcon = h("i", { class: "fa-solid fa-right-left" });
  sideBtn.append(sideIcon);
  sideBtn.addEventListener("click", () => {
    if (state.mySide === "left") {
      state.mySide = "right";
      leftSidePlayer.textContent = state.opponent?.alias ?? "Opponent";
      rightSidePlayer.textContent = state.me.alias;
    } else {
      state.mySide = "left";
      leftSidePlayer.textContent = state.me.alias;
      rightSidePlayer.textContent = state.opponent?.alias ?? "Opponent";
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

  startBtn.addEventListener("click", () => {
    clearInterval(t);
    observeOpponent.disconnect();
    onStart({ ...state });
  });

  right.append(summary, startBtn);
  mount(wrap, left, right);

  canStart(); // <-- add this line so Start enables if opponent is prefilled

  return { el: wrap };
}

/* =========================================================================
   Header (shared for 2D/3D)
============================================================================ */
function MatchHeader(me: User, opp: User, mySide: Side, getScores: () => { left: number; right: number }) {
  const bar = h("div", { class: "h-16 px-4 border-b border-emerald-100 bg-emerald-50/70 flex items-center justify-between" });

  const leftBox = h("div", { class: "flex items-center gap-3" });
  const rightBox = h("div", { class: "flex items-center gap-3" });

  const meLeft = mySide === "left";
  const L = meLeft ? me : opp;
  const R = meLeft ? opp : me;

  const lScore = h("div", { class: "px-3 py-1 rounded-lg bg-white text-emerald-700 font-semibold min-w-10 text-center", text: "0" });
  const rScore = h("div", { class: "px-3 py-1 rounded-lg bg-white text-emerald-700 font-semibold min-w-10 text-center", text: "0" });

  leftBox.append(Avatar(L.avatar, 32), h("div", { class: "font-semibold text-emerald-900", text: L.alias }), lScore);
  rightBox.append(rScore, h("div", { class: "font-semibold text-emerald-900", text: R.alias }), Avatar(R.avatar, 32));

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
function GameView2D(root: HTMLElement, me: User, opp: User, settings: Settings) {
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

/* =========================================================================
   Main exported view
============================================================================ */
export const PlayView: View = (root: HTMLElement) => {
  const holder = h("div", { class: "flex flex-col gap-2" });
  root.replaceChildren(holder);

  // Consume preset once
  const preset = _playPreset;
  _playPreset = null;

  // Me default if not provided by preset
  const defaultMe: User = { id: 1, alias: "You", avatar: "/user.png" };

  // Build prefill for SettingsPanel depending on preset
  let prefill: Partial<Settings> | null = null;
  if (preset?.kind === "duel") {
    prefill = {
      me: preset.me ?? defaultMe,
      opponent: preset.opponent,
      mySide: "left",
    };
  } else if (preset?.kind === "tournament") {
    prefill = {
      me: preset.p1, // player 1 on the left
      opponent: preset.p2, // player 2 on the right
      mySide: "left",
      pointsToWin: preset.pointsToWin ?? 3,
    };
  }

  // STEP 1: settings panel
  const settings = SettingsPanel(prefill, (s) => {
    // Go to game mode with the chosen players
    holder.replaceChildren();
    const me = s.me; // <-- use prefilled/custom me
    const opp = s.opponent!;

    const unmount = s.mode === "2d" ? GameView2D(holder, me, opp, s) : GameView2D(holder, me, opp, s); // 3D can be wired later

    const backBar = h("div", { class: "mt-3 flex justify-center" });
    const back = h("button", {
      class: "px-3 py-2 rounded-md text-white bg-rose-600 border border-slate-200 hover:bg-rose-500",
      attributes: { type: "button" },
      text: "Cancel Match",
    });
    back.addEventListener("click", () => {
      unmount?.();
      holder.replaceChildren(settings.el);
    });
    backBar.append(back);
    holder.append(backBar);
  });

  holder.append(settings.el);
  return () => {};
};
