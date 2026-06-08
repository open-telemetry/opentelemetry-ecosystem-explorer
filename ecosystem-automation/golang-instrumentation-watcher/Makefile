##r 🔭 otel-explorer-go-docs 🔭
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

.PHONY: sync
sync: ## 🔄 Run the full watcher pipeline (scan + metadata)
	go run $(CMD)

.PHONY: dev
dev: ## 🚀 Generate registry and validate with weaver
	go run $(CMD)
	$(MAKE) weaver-check

.PHONY: lint
lint: ## 🧹 Run linter checks
	golangci-lint run
	$(MAKE) weaver-check

.PHONY: fmt
fmt: ## ✨ Format code
	go fmt ./...

.PHONY: tidy
tidy: ## 📚 Tidy modules
	go mod tidy

.PHONY: docs
docs: ## 📖 Godocs
	go doc -http

.PHONY: test
test: ## 🧪 Run all tests
	go test -test.v -race -covermode=atomic -coverprofile=coverage.out ./... && \
	go tool cover -html=coverage.out -o coverage.html && \
	echo "Coverage report saved to coverage.html" && \
	rm -f coverage.out

.PHONY: test-perf
test-perf: ## ⚡ Run benchmark tests
	go test -test.v -benchmem -bench=. -coverprofile=coverage-bench.out ./... && \
	go tool cover -html=coverage-bench.out -o coverage-bench.html && \
	echo "Coverage report saved to coverage-bench.html" && \
	rm -f coverage-bench.out

.PHONY: vuln
vuln: ## 🛡️  Scan for vulnerabilities
	go install golang.org/x/vuln/cmd/govulncheck@latest
	govulncheck ./...

.PHONY: pre-commit
pre-commit: fmt tidy lint test ## ✅ Run all checks

.PHONY: snapshot
snapshot: ## 📸 Generate and post watcher output snapshot as a PR comment
	go run ./cmd/snapshot/ | ./scripts/upsert-pr-comment.sh

.PHONY: install
install: ## 📦 Install dependencies
	@which weaver > /dev/null || ( \
		echo "Installing weaver..." && \
		curl -sSL https://github.com/open-telemetry/weaver/releases/latest/download/weaver-$(shell uname -s | tr A-Z a-z)-$(shell uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz | tar xz -C /tmp && \
		sudo mv /tmp/weaver /usr/local/bin/weaver && \
		echo "Weaver installed successfully" \
	)

.PHONY: weaver-check
weaver-check: ## ✅ Validate registry with weaver
	weaver registry check -r registry;

.PHONY: weaver-stats
weaver-stats: ## 📊 Show registry statistics with weaver
	weaver registry stats -r registry

# pass through CLI flags to ./cmd/
%:
	@:
