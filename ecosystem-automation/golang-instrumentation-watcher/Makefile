## 🔭 opentelemetry-ecosystem-explorer/golang-instrumentation-watcher 🔭
SHELL := /bin/bash
MAKEFLAGS += --silent

BINARY_NAME_BASE=golang-instrumentation-watcher
CMD=./cmd/watcher

all: help

.PHONY: help
help: ## ❓ Makefile commands
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: build
build: ## 🔨 Build the watcher binary
	go build -o $(BINARY_NAME_BASE) $(CMD)

.PHONY: clean
clean: ## 🧹 Cleanup build artifacts
	go clean && rm -rf .repo $(BINARY_NAME_BASE) coverage.* instrumentation-list.yaml

.PHONY: fmt
fmt: ## ✨ Format code
	go fmt ./...

.PHONY: tidy
tidy: ## 📚 Tidy modules
	go mod tidy

.PHONY: docs
docs: ## 📖 Serve godocs @ http://localhost:6060/github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher
	go run golang.org/x/pkgsite/cmd/pkgsite@latest -http=localhost:6060 .

.PHONY: test
test: ## 🧪 Run all tests
	go test -test.v -race -covermode=atomic -coverprofile=coverage.out ./... && \
	go tool cover -html=coverage.out -o coverage.html && \
	echo "Coverage report saved to coverage.html" && \
	rm -f coverage.out

.PHONY: test-integration
test-integration: ## 🌐 Run integration tests (clones upstream repos)
	go test -tags=integration -race ./...

.PHONY: pre-commit
pre-commit: fmt tidy lint test ## ✅ Run all checks
	bun run format

# pass through CLI flags to ./cmd/
%:
	@:
