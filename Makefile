up:
	@echo "Starting Docker images..."
	docker compose -f docker-compose.yml up --build -d
	@echo "Docker images started!"

down:
	@echo "Stopping Docker images..."
	docker compose -f docker-compose.yml down -v
	@echo "Docker images stopped!"

up-dev:
	@echo "Starting Docker images..."
	docker compose -f docker-compose-dev.yml up --build -d
	@echo "Docker images started!"

down-dev:
	@echo "Stopping Docker images..."
	docker compose -f docker-compose-dev.yml down -v
	@echo "Docker images stopped!"