.DEFAULT_GOAL := help

.PHONY: help install run build start lint lint-fix format format-check typecheck test test-watch test-coverage check ci clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

run: ## Run the dev server (Turbopack) at http://localhost:3000
	npm run dev

build: ## Production build (also runs tsc)
	npm run build

start: ## Serve the production build
	npm start

lint: ## Run ESLint
	npm run lint

lint-fix: ## Run ESLint with autofix
	npm run lint:fix

format: ## Format files with Prettier
	npm run format

format-check: ## Check formatting (used by CI)
	npm run format:check

typecheck: ## Type-check with tsc --noEmit
	npm run typecheck

test: ## Run tests once (Vitest)
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage
	npm run test:coverage

check ci: lint format-check typecheck test build ## Run the full CI pipeline locally

clean: ## Remove build artifacts and dependencies
	rm -rf .next node_modules
