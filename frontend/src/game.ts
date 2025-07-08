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

	startGameLoop(canvas, context);
}

// interface GameState
// {
// 	player1Y: number;
// 	player2Y: number;
// 	score1: 
// }


const pressedKeys: Record<string, boolean> = {};

function startGameLoop(canvas : HTMLCanvasElement, ctx : CanvasRenderingContext2D)
{
	window.addEventListener("keydown", (e) => { pressedKeys[e.key] = true; });
	window.addEventListener("keyup", (e) => { pressedKeys[e.key] = false; });

	let paddleWidth = 10;
	let paddleHeight = 100;

	let player1Y = canvas.height / 2 - paddleHeight / 2;
	let player2Y = canvas.height / 2 - paddleHeight / 2;

	let ballX = canvas.width / 2;
	let ballY = canvas.height / 2;
	let ballRadius = 10;
	let ballSpeedX = 3;
	let ballSpeedY = 2;

	function draw()
	{
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		
		ctx.fillStyle = "white";
		
		if (pressedKeys["z"])	player1Y -= 5;
		if (pressedKeys["s"])	player1Y += 5;
		if (pressedKeys["ArrowUp"])	player2Y -= 5;
		if (pressedKeys["ArrowDown"])	player2Y += 5;

		player1Y = Math.max(0, Math.min(canvas.height - paddleHeight, player1Y));
		player2Y = Math.max(0, Math.min(canvas.height - paddleHeight, player2Y));


		ctx.fillRect(10, player1Y, paddleWidth, paddleHeight);
		ctx.fillRect(canvas.width - 20, player2Y, paddleWidth, paddleHeight);

		ctx.beginPath();
		ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
		ctx.fill();

		ballX += ballSpeedX;
		ballY += ballSpeedY;

		if (ballY < 0 || ballY > canvas.height)
			ballSpeedY = -ballSpeedY;

		if ((ballX - ballRadius < 20 && ballY > player1Y && ballY < player1Y + paddleHeight)
			|| (ballX + ballRadius > canvas.width - 20 && ballY > player2Y && ballY < player2Y + paddleHeight))
			ballSpeedX = -ballSpeedX;

		if (ballX < 0 || ballX > canvas.width)
		{
			ballX = canvas.width / 2;
			ballY = canvas.height / 2;
			ballSpeedX = -ballSpeedX;
		}
	}

	function gameLoop()
	{
		draw();
		requestAnimationFrame(gameLoop);
	}

	gameLoop();
}