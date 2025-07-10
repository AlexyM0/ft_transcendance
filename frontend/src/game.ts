// game.ts

export function renderGameView(container: HTMLElement)
{
	const canvas = document.createElement("canvas");
	canvas.width = 800;
	canvas.height = 600;
	canvas.className = "border bg-black";
	
	container.appendChild(canvas);

	const context = canvas.getContext("2d");
	if (!context)
	{
		console.error("Failed to get canvas context");
		return ;
	}

	const game = new Game(canvas, context);
	game.start();
}

class	Player {
	name: 			string;
	x:				number;		// X position on Canvas
	y:				number;		// Y position on Canvas
	width:			number;
	height:			number;
	color:			string;
	upKey:			string;
	downKey:		string;
	score:			number;
	isMovingUp:		boolean;
	isMovingDown:	boolean;

	constructor (name: string, x: number, y: number, upKey: string, downKey: string, height: number = 100, color: string = "white")
	{
		this.name = name;
		this.x = x;
		this.y = y;
		this.width = 10;
		this.height = height;
		this.color = color;
		this.upKey = upKey;
		this.downKey = downKey;
		this.score = 0;
		this.isMovingUp = false;
		this.isMovingDown = false;
	}

	updatePosition(delta: number, canvasHeight: number)
	{
		const speed = 600;
		if (this.isMovingUp)	this.y -= speed * delta;
		if (this.isMovingDown)	this.y += speed * delta;
		this.y = Math.max(0, Math.min(canvasHeight - this.height, this.y));
	}
}

class	Ball {
	x: number;
	y: number;
	radius: number;
	speedX: number;
	speedY: number;
	acceleration: number;

	constructor (startX: number, startY: number)
	{
		this.x = startX;
		this.y = startY;
		this.radius = 10;
		this.speedX = 300;
		this.speedY = 200;
		this.acceleration = 1.05;
	}

	updatePosition(delta: number, canvas: HTMLCanvasElement, player1: Player, player2: Player) : number | null
	{
		this.x += this.speedX * delta;
		this.y += this.speedY * delta;

		if (this.y - this.radius < 0 || this.y + this.radius > canvas.height)
			this.speedY *= -1;

		const hitPlayer1 = (
			this.x - this.radius < player1.x + player1.width &&
			this.x - this.radius > player1.x &&
			this.isInPaddleRangeY(player1)
		);

		const hitPlayer2 = (
			this.x + this.radius > player2.x &&
			this.x + this.radius < player2.x + player2.width &&
			this.isInPaddleRangeY(player2)
		);

		if (hitPlayer1 || hitPlayer2)
		{
			this.speedX *= -1 * this.acceleration;
			this.speedY *= this.acceleration;
		}
			

		if (this.x < 0)	return 2;
		if (this.x > canvas.width)	return 1;

		return null;
	}

	isInPaddleRangeY(player: Player) : boolean
	{
		return ((player.y < this.y + this.radius && this.y - this.radius < player.y + player.height));
	}

	reset(centerX: number, centerY: number)
	{
		this.x = centerX;
		this.y = centerY;
		this.speedX = (Math.random() > 0.5 ? 1 : -1) * 300;
		this.speedY = (Math.random() > 0.5 ? 1 : -1) * 200;
	}
}

class	Game {
	canvas: 		HTMLCanvasElement;
	ctx: 			CanvasRenderingContext2D;
	player1:		Player;
	player2:		Player;
	ball:			Ball;
	isPaused: 		boolean;
	isOver:			boolean;
	winner:			Player;
	lastTimestamp:	number;

	constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D)
	{
		this.canvas = canvas;
		this.ctx = ctx;
		this.player1 = new Player("Player 1", 10, canvas.height / 2, "z", "s", 100, "powderblue");
		this.player2 = new Player("Player 2", canvas.width - 10 - 10, canvas.height / 2, "ArrowUp", "ArrowDown", 100, "pink");
		this.ball = new Ball(canvas.width / 2, canvas.height / 2);
		this.isPaused = true;
		this.isOver = false;
		this.lastTimestamp = 0;
		this.setupListeners();
	}

	setupListeners()
	{
		window.addEventListener("keydown", (e) => {
			if (e.key === " " && !e.repeat)	
			{
				if (this.isOver)
				{
					this.player1.score = 0;
					this.player2.score = 0;
					this.ball.reset(this.canvas.width / 2, this.canvas.height / 2);
					this.isOver = false;
				}
				this.isPaused = !this.isPaused;
			}
			if (e.key === this.player1.upKey)	this.player1.isMovingUp = true;
			if (e.key === this.player1.downKey)	this.player1.isMovingDown = true;
			if (e.key === this.player2.upKey)	this.player2.isMovingUp = true;
			if (e.key === this.player2.downKey)	this.player2.isMovingDown = true;
		});
		
		window.addEventListener("keyup", (e) => {
			if (e.key === this.player1.upKey)	this.player1.isMovingUp = false;
			if (e.key === this.player1.downKey)	this.player1.isMovingDown = false;
			if (e.key === this.player2.upKey)	this.player2.isMovingUp = false;
			if (e.key === this.player2.downKey)	this.player2.isMovingDown = false;
		});
	}

	start()
	{
		this.lastTimestamp = performance.now();
		requestAnimationFrame(this.loop.bind(this));
	}

	loop(timestamp: number)
	{
		const delta = (timestamp - this.lastTimestamp) / 1000;
		this.lastTimestamp = timestamp;

		if (!this.isPaused)
			this.update(delta);
		this.draw();
		console.log("Drawing frame", this.ball.x, this.ball.y);
		requestAnimationFrame(this.loop.bind(this));
	}

	update(delta: number)
	{
		this.player1.updatePosition(delta, this.canvas.height);
		this.player2.updatePosition(delta, this.canvas.height);

		const scorer = this.ball.updatePosition(delta, this.canvas, this.player1, this.player2);
		if (scorer)
		{
			if (scorer === 1)	this.player1.score++;
			else				this.player2.score++;

			if (this.player1.score >= 3)
			{
				this.winner = this.player1;
				this.isOver = true;
			}
			else if (this.player2.score >= 3)
			{
				this.winner = this.player2;
				this.isOver = true;
			}
			this.ball.reset(this.canvas.width / 2, this.canvas.height / 2);
			this.isPaused = true;
		}
	}

	draw()
	{
		this.ctx.fillStyle = "midnightblue";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.ctx.fillStyle = "white";
		this.ctx.beginPath();
		this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.fillStyle = this.player1.color;
		this.ctx.fillRect(this.player1.x, this.player1.y, this.player1.width, this.player1.height);
		this.ctx.fillStyle = this.player2.color;
		this.ctx.fillRect(this.player2.x, this.player2.y, this.player2.width, this.player2.height);

		this.ctx.fillStyle = "white";
		this.ctx.font = "24px sans-serif";
		this.ctx.textAlign = "left";
		this.ctx.fillText(`${this.player1.name}: ${this.player1.score}`, 30, 30);
		this.ctx.textAlign = "right";
		this.ctx.fillText(`${this.player2.name}: ${this.player2.score}`, this.canvas.width - 30, 30);

		if (this.isPaused)
		{
			this.ctx.fillStyle = "rgba(255,255,255,0.5)";
			this.ctx.font = "32px sans-serif";
			this.ctx.textAlign = "center";

			if (this.isOver) {
				this.ctx.fillText(`${this.winner.name} Wins! Press Space to Restart`, this.canvas.width / 2, this.canvas.height / 2 - 50);
			} else {
				this.ctx.fillText("Press Space to Resume", this.canvas.width / 2, this.canvas.height / 2 - 50);
			}
		}
	}
}

