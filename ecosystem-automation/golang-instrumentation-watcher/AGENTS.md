# AGENTS.md — golang-instrumentation-watcher

The Go instrumentation watcher. It clones opentelemetry-go-contrib, extracts
instrumentation metadata and telemetry via static analysis (Go AST), and writes
a versioned inventory under `ecosystem-registry/go/contrib/` that
`explorer-db-builder` consumes. See `README.md` for the pipeline and output
format, and `../AGENTS.md` for the shared watcher contract (idempotency,
inventory layout, schema discipline, deterministic output).

Go 1.21+. Linter: golangci-lint. Tests: the standard toolchain.

## Commands

Run from this directory:

- `make sync` — Run the full watcher pipeline → versioned inventory
- `make dev` — Run the pipeline and validate the Weaver dev registry
- `make build` — Build the watcher binary
- `make test` — Run all tests
- `make lint` — Run golangci-lint (+ weaver check)
- `make pre-commit` — fmt, tidy, lint, test

Some `repo` and `instrumentation` tests clone opentelemetry-go-contrib over the
network and take ~30s. Network-only checks are gated behind the `integration`
build tag (`go test -tags integration ./repo/`).

## Commits

This watcher lives in a shared monorepo with a shared Git log. Follow
[Conventional Commits](https://www.conventionalcommits.org/) and the scope
convention used across this repo: the scope is the component path, abbreviated
to the ecosystem and language.

- **Scope:** `ecosystem-automation/golang` — e.g.
  `feat(ecosystem-automation/golang): resolve go-contrib release tags`.
- Use the standard types (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`,
  `style`, `perf`).
- No AI attribution, `Co-Authored-By`, or tool links in commit messages.
- Keep the log reviewable: one logical change per commit, not a play-by-play of
  the editing session.

## Footguns

- The `insturmentation` typo in the module path and directory name is fixed —
  the module is `.../golang-instrumentation-watcher`. Don't reintroduce it.
- Snapshot writes must clean up the prior snapshot and write a replacement in
  the same run, or the frontend sees a missing snapshot until the next sync.
- Don't hand-edit files under `ecosystem-registry/` — they are pipeline output
  and the immutable historical record.
