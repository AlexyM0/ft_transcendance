// src/helpers/GameRenderer.ts
import { WORLD_W, WORLD_H } from "./GameConstants";
import type { MatchState, BallSprite } from "./GameTypes";

export class GameRenderer {
  private dpr = window.devicePixelRatio || 1;
  private scale = 1;
  private ctx: CanvasRenderingContext2D;
  private resizeObs!: ResizeObserver;
  private ballSprite: BallSprite = {
    img: null,
    ready: false,
    angle: 0,
    spinPerSec: 1,
  };
  private lastDrawMs: number | null = null;

  countdown: number | null = null;
  paused = true;
  over = false;
  //   winnerName: string | null = null;
  overMessage: string | null = null;

  constructor(private wrap: HTMLElement, private canvas: HTMLCanvasElement, private header: HTMLElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context failed");
    this.ctx = ctx;
    this.installResize();
  }

  setBallSprite(url: string) {
    const img = new Image();
    img.onload = () => {
      this.ballSprite.img = img;
      this.ballSprite.ready = true;
      this.ballSprite.angle = 0;
    };
    img.crossOrigin = "anonymous";
    img.src = url;
  }

  dispose() {
    this.resizeObs?.disconnect();
  }

  setCountdown(n: number | null) {
    this.countdown = n;
  }

  setPaused(p: boolean) {
    this.paused = p;
  }

  setOver(overMessage: string | null) {
    this.over = !!overMessage;
    this.overMessage = overMessage;
  }

  draw(s: MatchState) {
    const now = performance.now();
    if (this.lastDrawMs === null) this.lastDrawMs = now;
    const deltaTime = (now - this.lastDrawMs) / 1000;
    this.lastDrawMs = now;

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0);

    // Field - background
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, "#162322");
    g.addColorStop(1, "#2e736c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Field - rectangle
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, WORLD_W - 4, WORLD_H - 4);
    ctx.save();

    // Field - middle line
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(WORLD_W / 2, 10);
    ctx.lineTo(WORLD_W / 2, WORLD_H - 10);
    ctx.stroke();
    ctx.restore();

    // Field - center circle
    ctx.beginPath();
    ctx.arc(WORLD_W / 2, WORLD_H / 2, Math.min(WORLD_W, WORLD_H) * 0.1, 0, Math.PI * 2);
    ctx.stroke();

    // Paddles
    ctx.fillStyle = s.leftP.color ?? "#e2f7e1";
    ctx.fillRect(s.leftP.paddle.x, s.leftP.paddle.y, s.leftP.paddle.width, s.leftP.paddle.height);
    ctx.fillStyle = s.rightP.color ?? "#fde2e2";
    ctx.fillRect(s.rightP.paddle.x, s.rightP.paddle.y, s.rightP.paddle.width, s.rightP.paddle.height);

    // Ball
    const { x, y, radius } = s.ball.area;
    if (this.ballSprite.ready && this.ballSprite.img) {
      this.ballSprite.angle += Math.PI * 2 * this.ballSprite.spinPerSec * deltaTime;
      ctx.save();
      ctx.translate(x, y);
      if (!this.paused) {
        ctx.rotate(this.ballSprite.angle);
      }

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip();

      ctx.drawImage(this.ballSprite.img, -radius, -radius, 2 * radius, 2 * radius);
      ctx.restore();

      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "white";
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Overlay
    if (this.paused || this.countdown || this.over) {
      const msg = this.countdown ? String(this.countdown) : this.over ? this.overMessage ?? "" : "Paused";

      const { width: pxW, height: pxH } = this.canvas;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const fontPx = Math.max(32, Math.floor(pxH * 0.16));
      ctx.font = `${fontPx}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Backdrop on the game canvas when paused
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(0, 0, pxW, pxH);

      // Subtle stroke + fill so it pops
      ctx.lineWidth = Math.max(2, Math.floor(fontPx * 0.06));
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.fillStyle = "white";
      const cx = pxW / 2,
        cy = Math.floor(pxH * 0.25);
      ctx.strokeText(msg, cx, cy);
      ctx.fillText(msg, cx, cy);

      ctx.restore();
    }
  }

  private installResize() {
    const fit = () => {
      const availW = this.wrap.clientWidth;
      const availH = this.wrap.clientHeight - this.header.clientHeight - 12;
      const scale = Math.min(availW / WORLD_W, availH / WORLD_H);
      this.scale = Math.max(scale, 0.5);

      const cssW = Math.floor(WORLD_W * this.scale);
      const cssH = Math.floor(WORLD_H * this.scale);
      this.canvas.style.width = cssW + "px";
      this.canvas.style.height = cssH + "px";

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
}
