---
applyTo: ".github/workflows/**/*.{yml,yaml}"
---

# GitHub Actions review rules

## Action pinning (security-critical)

- **Pin third-party actions to a full commit SHA**, not to a tag or branch. Floating tags can be
  re-pointed by a compromised maintainer.
- Add a version comment after the SHA for readability.
- Format: `uses: owner/action@<full-40-char-sha> # vX.Y.Z`

Examples to flag:

- `uses: actions/checkout@v4` — unpinned, flag.
- `uses: actions/checkout@main` — floating ref, flag.
- `uses: actions/checkout@abc1234` — short SHA, flag.

The current canonical pin in this repo is
`actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2`. When updating an action
version, update all callers together.

## Permissions

- Workflows must declare a top-level `permissions:` block.
- Default to `contents: read` (top-level or per-job) and escalate per-job only when needed.
- Flag escalations to `contents: write`, `pull-requests: write`, or `id-token: write` in **net-new**
  workflows. Established workflows (nightly registry update, screenshots, db-builder) legitimately
  need write access; do not re-litigate them.

## Secrets and inputs

- Flag `${{ secrets.* }}` interpolated directly into a `run:` shell script. Pass via `env:` so the
  value is masked and not subject to shell expansion.
- Flag `${{ github.event.* }}` (PR titles, branch names, issue bodies) interpolated into shell.
  Treat event payload as untrusted; pass via `env:` and reference as a shell variable.

## Triggers

- Flag `pull_request_target` workflows that check out PR head code. That combination grants secrets
  to untrusted code.
- Scheduled or nightly workflows must gate on
  `if: github.repository == 'open-telemetry/opentelemetry-ecosystem-explorer'` so forks don't
  accidentally run them.

## Repo-specific gotchas

- `build-explorer-database.yml` auto-bumps `DB_VERSION` via
  `sed -i "s/const DB_VERSION = ${CURRENT};/const DB_VERSION = ${NEW};/"`. The `grep` pattern is
  `const DB_VERSION = \K[0-9]+`. Renaming the constant in `idb-cache.ts` breaks this workflow
  silently.
