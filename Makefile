SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help dev build check serve clean install api api-dev docker-build docker-up docker-down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install web dependencies
	cd apps/web && npm install

dev: ## Run the Next.js dev server (http://localhost:3000)
	cd apps/web && npm run dev

api: ## Build the C++ API and regenerate the SQLite database
	cd backend && ./scripts/setup.sh

api-dev: ## Run the API on http://127.0.0.1:8080
	cd backend && ./scripts/run-dev.sh

docker-build: ## Build the API Docker image
	docker compose build

docker-up: ## Start the API container (data + SQLite mounted read-only)
	docker compose up -d api

docker-down: ## Stop the API container
	docker compose down

build: ## Static production build into apps/web/out
	cd apps/web && npm run build

serve: build ## Build and serve the static output (http://localhost:8000)
	cd apps/web/out && python3 -m http.server 8000

check: ## Repo, JSON and data-contract checks (same as CI)
	bash scripts/check.sh

clean: ## Remove build artifacts
	rm -rf apps/web/.next apps/web/out backend/build
