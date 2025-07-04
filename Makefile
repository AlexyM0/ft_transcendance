up:
	docker-compose up --build

down:
	docker-compose down

logs:
	docker-compose logs -f

ps:
	docker-compose ps

restart:
	docker-compose down
	docker-compose up --build

# Commande par défaut
.DEFAULT_GOAL := up