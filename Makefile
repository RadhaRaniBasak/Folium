.PHONY: dev build test docker\:up docker\:down

dev:
	npm run dev

build:
	npm run build

test:
	npm run test --workspaces --if-present

docker\:up:
	docker compose up -d

docker\:down:
	docker compose down
