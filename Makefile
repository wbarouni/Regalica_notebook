.PHONY: up down reset check smoke

up:
	docker compose -f deploy/docker/docker-compose.yml up -d

down:
	docker compose -f deploy/docker/docker-compose.yml down

reset:
	./scripts/dev-reset.sh

check:
	./scripts/denylist.sh && ./scripts/healthcheck.sh

smoke:
	./scripts/smoke.sh
