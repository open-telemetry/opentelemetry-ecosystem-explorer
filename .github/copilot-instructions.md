# Copilot code review instructions

OpenTelemetry Ecosystem Explorer is a CNCF public repo with three components plus a planning
workspace.

- `ecosystem-registry/` — versioned upstream metadata. **Never edited by hand**; written by
  automation, immutable history.
- `ecosystem-automation/` — Python 3.11+ watchers (uv + Ruff + pytest).
- `ecosystem-explorer/` — React 19 + Vite + TypeScript + Tailwind v4 frontend (Bun, Vitest for both
  unit and integration tests).
- `projects/<issue>-<slug>/` — planning artifacts validated by `projects/frontmatter.schema.json`.

Path-scoped rules live in `.github/instructions/`. Read the matching one alongside this file when
reviewing.

## Glossary

- **watcher** — Python pipeline that reads upstream and writes versioned YAML to
  `ecosystem-registry/`.
- **inventory** — directory layout under
  `ecosystem-registry/{ecosystem}/{distribution}/v{version}/`.
- **explorer-db-builder** — converts the registry into JSON under `ecosystem-explorer/public/data/`.
- **DB_VERSION** — IndexedDB schema version constant in
  `ecosystem-explorer/src/lib/api/idb-cache.ts`. Auto-bumped by
  `.github/workflows/build-explorer-database.yml`.
- **`[automated]` PR** — bot-authored PR by `app/otelbot` (or `app/renovate`). The diff is
  regenerated output, not human-written code.
- **`DataState<T>`** — canonical async hook return shape (`{ data, loading, error }`) in
  `src/hooks/data-state.ts`.
- **wrapped Radix primitive** — re-export under `src/components/ui/` adding Tailwind classes and
  accessibility defaults.
- **javaagent / declarative configuration / configuration builder** — Java auto-instrumentation
  domain. Field names are snake_case end-to-end.

## Review priorities

- Stay on the diff. Do not propose refactors of code outside the change.
- One concern per PR. If the PR is gated by a feature flag (e.g. `JAVA_CONFIG_BUILDER`,
  `COLLECTOR_PAGE`, `V1_REDESIGN`), only flag bugs in the changed lines. Followup work belongs in a
  separate PR.
- Use `bun`, not `node`, for scripts and docs in `ecosystem-explorer/`.
- Imports go at the top of the file. A local import is acceptable only when a circular dependency
  forces it, and the workaround must be explained inline.
- Comments explain WHY (invariant, footgun, workaround). Flag comments that restate the code.
- Flag added TODOs, dead code, or commented-out blocks introduced by the diff.
- Flag drive-by formatting changes in files unrelated to the PR.

## Things you should NOT flag

- Style enforced by Ruff, ESLint, Prettier, or markdownlint — all four run in CI.
- Existing patterns adjacent to the change. Stay focused on the diff.
- Missing PR template fields, screenshots, or changelog entries.
- Lockfile churn (`bun.lock`, `package-lock.json`, `uv.lock`) when the `package.json` or
  `pyproject.toml` change is justified.
- Anything in PRs whose title starts with `[automated]` or whose author is `app/otelbot` /
  `app/renovate`. The diff is regenerated output.
- Hypothetical race conditions or edge cases without concrete evidence (e.g. multi-tab IndexedDB
  races, empty-map combinations).
- Memoization suggestions (`useMemo`, `useCallback`) without measurable evidence of a render
  hotspot.
- Manual `type="button"` on every `<button>` in WIP UI gated by a feature flag.
- `^` semver ranges in `package.json` — the lockfile is the pin.
- Two-blank-lines or other Python whitespace — Ruff format enforces it.
- Schema URI scheme (`http://` vs `https://`) on JSON Schema meta-schemas.
