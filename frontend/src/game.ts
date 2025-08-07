/******************************************************************
 *  game.ts – canvas Pong with i18n strings
 ******************************************************************/

import { t } from "./i18n";


export async function renderGameView(container: HTMLElement) {
  // prépare les traductions une seule fois
  const texts = {
    player1Label : await t("game.player1"),
    player2Label : await t("game.player2"),
    pressResume  : await t("game.press_space"),
    winsTemplate : await t("game.wins")            // contient {{player}}
  };

  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  canvas.className = "border bg-black";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Failed to get canvas context");
    return;
  }

  new Game(canvas, ctx, texts).start();
}

/* ───────── Classes du jeu ───────── */

class Player {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public upKey: string,
    public downKey: string,
    public height: number = 100,
    public color: string = "white"
  ) {
    this.width = 10;
    this.score = 0;
    this.isMovingUp = false;
    this.isMovingDown = false;
  }
  width: number;
  score: number;
  isMovingUp: boolean;
  isMovingDown: boolean;

  updatePosition(delta: number, canvasHeight: number) {
    const speed = 600;
    if (this.isMovingUp) this.y -= speed * delta;
    if (this.isMovingDown) this.y += speed * delta;
    this.y = Math.max(0, Math.min(canvasHeight - this.height, this.y));
  }
}

class Ball {
  x: number;
  y: number;
  radius = 10;
  speedX = 300;
  speedY = 200;
  acceleration = 1.05;

  constructor(startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
  }

  updatePosition(
    delta: number,
    canvas: HTMLCanvasElement,
    p1: Player,
    p2: Player
  ): number | null {
    this.x += this.speedX * delta;
    this.y += this.speedY * delta;

    if (this.y - this.radius < 0 || this.y + this.radius > canvas.height)
      this.speedY *= -1;

    const hitP1 =
      this.x - this.radius < p1.x + p1.width &&
      this.x - this.radius > p1.x &&
      this.inY(p1);
    const hitP2 =
      this.x + this.radius > p2.x &&
      this.x + this.radius < p2.x + p2.width &&
      this.inY(p2);

    if (hitP1 || hitP2) {
      this.speedX *= -1 * this.acceleration;
      this.speedY *= this.acceleration;
    }

    if (this.x < 0) return 2;
    if (this.x > canvas.width) return 1;
    return null;
  }

  inY(p: Player) {
    return p.y < this.y + this.radius && this.y - this.radius < p.y + p.height;
  }

  reset(cx: number, cy: number) {
    this.x = cx;
    this.y = cy;
    this.speedX = (Math.random() > 0.5 ? 1 : -1) * 300;
    this.speedY = (Math.random() > 0.5 ? 1 : -1) * 200;
  }
}

class Game {
  player1: Player;
  player2: Player;
  ball: Ball;
  isPaused = true;
  isOver = false;
  winner!: Player;
  lastTimestamp = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
    private txt: {
      player1Label: string;
      player2Label: string;
      pressResume: string;
      winsTemplate: string;
    }
  ) {
    this.player1 = new Player(this.txt.player1Label, 10, canvas.height / 2, "z", "s", 100, "powderblue");
    this.player2 = new Player(this.txt.player2Label, canvas.width - 20, canvas.height / 2, "ArrowUp", "ArrowDown", 100, "pink");
    this.ball = new Ball(canvas.width / 2, canvas.height / 2);
    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener("keydown", (e) => {
      if (e.key === " " && !e.repeat) {
        if (this.isOver) {
          this.player1.score = 0;
          this.player2.score = 0;
          this.ball.reset(this.canvas.width / 2, this.canvas.height / 2);
          this.isOver = false;
        }
        this.isPaused = !this.isPaused;
      }
      if (e.key === this.player1.upKey) this.player1.isMovingUp = true;
      if (e.key === this.player1.downKey) this.player1.isMovingDown = true;
      if (e.key === this.player2.upKey) this.player2.isMovingUp = true;
      if (e.key === this.player2.downKey) this.player2.isMovingDown = true;
    });

    window.addEventListener("keyup", (e) => {
      if (e.key === this.player1.upKey) this.player1.isMovingUp = false;
      if (e.key === this.player1.downKey) this.player1.isMovingDown = false;
      if (e.key === this.player2.upKey) this.player2.isMovingUp = false;
      if (e.key === this.player2.downKey) this.player2.isMovingDown = false;
    });
  }

  start() {
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  loop(ts: number) {
    const delta = (ts - this.lastTimestamp) / 1000;
    this.lastTimestamp = ts;

    if (!this.isPaused) this.update(delta);
    this.draw();
    requestAnimationFrame(this.loop.bind(this));
  }

  update(delta: number) {
    this.player1.updatePosition(delta, this.canvas.height);
    this.player2.updatePosition(delta, this.canvas.height);

    const scorer = this.ball.updatePosition(
      delta,
      this.canvas,
      this.player1,
      this.player2
    );
    if (scorer) {
      scorer === 1 ? this.player1.score++ : this.player2.score++;

      if (this.player1.score >= 3) {
        this.winner = this.player1;
        this.isOver = true;
      } else if (this.player2.score >= 3) {
        this.winner = this.player2;
        this.isOver = true;
      }
      this.ball.reset(this.canvas.width / 2, this.canvas.height / 2);
      this.isPaused = true;
    }
  }

  draw() {
    const { ctx } = this;
    ctx.fillStyle = "midnightblue";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.player1.color;
    ctx.fillRect(this.player1.x, this.player1.y, this.player1.width, this.player1.height);
    ctx.fillStyle = this.player2.color;
    ctx.fillRect(this.player2.x, this.player2.y, this.player2.width, this.player2.height);

    ctx.fillStyle = "white";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${this.player1.name}: ${this.player1.score}`, 30, 30);
    ctx.textAlign = "right";
    ctx.fillText(`${this.player2.name}: ${this.player2.score}`, this.canvas.width - 30, 30);

    if (this.isPaused) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";

      if (this.isOver) {
        const msg = this.txt.winsTemplate.replace("{{player}}", this.winner.name);
        ctx.fillText(msg, this.canvas.width / 2, this.canvas.height / 2 - 50);
      } else {
        ctx.fillText(this.txt.pressResume, this.canvas.width / 2, this.canvas.height / 2 - 50);
      }
    }
  }
}
