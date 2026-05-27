---
applyTo: "ecosystem-explorer/**/*.{ts,tsx}"
---

# Frontend review rules

React 19 + Vite + TS, Tailwind v4, Radix UI. Vitest for unit AND integration tests
(`vitest.integration.config.ts` runs `src/test/integration/*.integration.test.ts(x)`). Playwright is
only for `scripts/take-screenshots.mjs`. Design system: `ecosystem-explorer/DESIGN.md`.

## Project structure

- `src/features/{feature}/` — feature pages, components, hooks. Tests alongside source.
- `src/components/ui/` — wrapped Radix primitives. Flag direct `@radix-ui/*` imports outside here.
- `src/components/layout/` — shared layout.
- `src/hooks/` — cross-feature hooks. Kebab-case `use-<thing>.ts(x)`.
- `src/lib/` — utilities, feature flags, theme tokens.
- `src/types/` — TS interfaces mirroring registry YAML. Snake_case fields (`display_name`,
  `disabled_by_default`, `_is_custom`). Flag camelCase additions.

`@/` alias maps to `src/`. Sibling `./` imports are common and fine. Flag deep relatives
(`../../lib/...`); ask for `@/`.

Routes register in `App.tsx`. Flag `<Route>` elsewhere or pages re-rendering header/footer locally.

## Comments and styling

- New explorer code ships **without comments**. Names, types, tests carry meaning. Flag added
  comments that restate code. Comments are only for non-obvious invariants, framework footguns, or
  workarounds — the "why" must be specific.
- Color tokens live in `src/themes.ts`. Flag hex or `rgb()` literals in component code.

## Data fetching

- Async hooks return `DataState<T>` from `src/hooks/data-state.ts` (`{ data, loading, error }`).
  Flag ad-hoc return shapes.
- Wrap fetching in a custom hook. Flag `fetch()` or `useEffect`-based fetching in components.
- Sanitize external URLs before binding to `href`. Reject non-`http(s)` schemes; user-facing fields
  like `library_link` or `repository` can carry `javascript:` URLs.

## State and IndexedDB

- Flag `setState` in render bodies — StrictMode double-invocation has bitten this codebase. Move to
  `useEffect` or event handlers.
- **Do NOT bump `DB_VERSION` in `src/lib/api/idb-cache.ts` in feature PRs.** It is auto-bumped by
  `.github/workflows/build-explorer-database.yml` when `public/data/` changes. Manual bumps are
  correct only when the IDB schema actually changes (`STORES`, `CACHE_EXPIRATION_MS`, upgrade
  logic).
- The destructive upgrade handler in `initDB` is intentional. Don't propose preserving stores across
  version changes.

## Feature flags

- `src/lib/feature-flags.ts` defines `FEATURE_FLAGS` as a const tuple. Adding a flag requires
  extending the tuple AND adding the env var to both `.env.development` and `.env.test`.
- Flag runtime toggling attempts. Flags are baked at build time from `VITE_FEATURE_FLAG_*`.

## Accessibility

- Semantic HTML (`<nav>`, `<main>`, `<button>`). Flag click handlers on non-interactive elements.
- Icon-only buttons need `aria-label`. Toggle/filter/favorite buttons need `aria-pressed`.
- Decorative SVGs need `role="img"` + `aria-label`, or `aria-hidden="true"` if purely decorative.
- Form inputs need `<label htmlFor>` linked to the input `id`. Use `aria-invalid` for errors.

## TypeScript and tests

- Strict TS: `bun run build` runs typecheck and blocks on unused locals. Flag `any` without
  justification, and `// @ts-ignore` / `// @ts-expect-error` without an explanation.
- Route params are unvalidated. Flag pages reading a URL param without checking for missing values.
- Mock `navigator.clipboard` via `Object.defineProperty(navigator, "clipboard", ...)` — jsdom method
  spies return `undefined`.
- Flag changes to non-trivial logic without test updates.
