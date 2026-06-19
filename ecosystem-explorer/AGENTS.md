# AGENTS.md — ecosystem-explorer

React 19 + Vite + TypeScript frontend that provides search and exploration for the OpenTelemetry
ecosystem. Tailwind CSS v4 for styling, Radix UI primitives, Vitest for both unit and integration
tests (Playwright is used only by `scripts/take-screenshots.mjs`).

For design system reference (colors, typography, spacing, component patterns) see `DESIGN.md` in
this directory.

## Commands

All commands run from `ecosystem-explorer/` with `bun`:

- `bun run serve` — Vite dev server
- `bun run build` — Production build (typecheck failures block the build)
- `bun run typecheck` — TypeScript check without emit
- `bun run lint` — ESLint
- `bun run format` — Prettier write
- `bun run test` — Unit tests (Vitest with jsdom)
- `bun run test -t "<name>"` — Run a single unit test by name
- `bun run test:integration` — Vitest integration tests (config: `vitest.integration.config.ts`)

## Project structure

- `src/features/{feature}/` — Feature-scoped pages, components, hooks, utils. Tests sit alongside
  source.
- `src/components/ui/` — Wrapped Radix UI primitives. Use these instead of importing Radix directly.
- `src/components/layout/` — Shared layout components.
- `src/hooks/` — Cross-feature hooks.
- `src/lib/` — Utilities, feature flags, theme tokens.

The `@/` import alias maps to `src/`. Always use `@/` for intra-`src` imports.

`App.tsx` reads the `V1_REDESIGN` flag once and renders one of two sub-apps under a shared
`<BrowserRouter>`: `LegacyApp.tsx` (default) or `src/v1/V1App.tsx` (v1 redesign). Each sub-app owns
its own `<Routes>` table and its own chrome — legacy uses `Header`/`Footer`, v1 uses
`NavBar`/`CncfCallout`/`FooterV1`. The two route tables mirror each other verbatim. To add a feature
route: create a `*-page.tsx` under `src/features/{feature}/`, then register the **same** `<Route>`
in **both** `LegacyApp.tsx` and `V1App.tsx` to keep them in sync. The chrome wraps all routes
globally, so do not duplicate it per page.

## Testing

- Unit tests live next to source as `*.test.ts(x)` and run with `bun run test`. Integration tests
  use `*.integration.test.ts(x)` and run with `bun run test:integration`.
- Add or update tests for the code you change.
- Use `bun run test -t "<name>"` to iterate on a single test without re-running the full suite.

## Data fetching

Wrap data fetching in custom hooks with explicit loading/data/error state. Do not fetch directly
inside components. IndexedDB is used for client-side caching with a 24-hour expiry. Bump the
IndexedDB schema version when changing it, or integration tests will fail with stale schema.

## Styling

- Color tokens are defined in `src/themes.ts` and applied via Tailwind classes. Do not hardcode
  colors.
- Every Radix primitive used in the app must have a wrapper in `src/components/ui/` that adds
  Tailwind styling and accessibility defaults.

## Feature flags

Feature flags live in `src/lib/feature-flags.ts` and are accessed via `isEnabled("FLAG_NAME")`.
They're read from `import.meta.env.VITE_FEATURE_FLAG_*` and baked at build time, so they cannot be
toggled at runtime. Document new flags in `.env.development` for local testing.

## Internationalization (i18n)

The app uses [i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/).
Runtime config lives in `src/i18n/config.ts`. Locale files are served as static JSON:

```text
public/locales/{lng}/{namespace}.json
```

Currently supported languages: `en`, `es`. Active namespaces: `common`, `layout`, `home`,
`collector`, `java-agent`, `about`, `ecosystem`.

### Patterns

**Inside a React component** — call the hook with the namespace closest to the component:

```tsx
const { t } = useTranslation("java-agent");
// ...
<button>{t("builder.controls.reset")}</button>;
```

**Text with embedded JSX** (links, formatted spans) — use the `Trans` component:

```tsx
import { Trans } from "react-i18next";

<Trans
  i18nKey="intro.description"
  ns="about"
  components={{ otelLink: <a href="https://opentelemetry.io" /> }}
/>;
```

The locale value uses the component name as a placeholder tag:
`"Visit <otelLink>OpenTelemetry</otelLink> to learn more."`

**Outside React** (module-level functions, utilities) — import `getI18n`:

```ts
import { getI18n } from "react-i18next";
getI18n().t("namespace:some.key");
```

### Adding a new namespace

1. Create `public/locales/{lng}/{ns}.json` for every supported language (currently `en` and `es`).
2. Add `"{ns}"` to the `ns` array in `src/i18n/config.ts`.
3. Add the import and entry to **both** test setup files:
   - `src/test/setup.ts` (unit tests)
   - `src/test/integration/setup.ts` (integration tests)

### Feature flag

The `I18N` flag (`VITE_FEATURE_FLAG_I18N`) gates the language-switcher UI and browser language
detection. When the flag is off, the app always renders in English. The translation keys and locale
files are always present regardless of the flag.

### Rules

- Never hardcode user-visible strings. Every label, tooltip, `aria-label`, and button text must go
  through `t()`.
- Do not use `getI18n()` inside a component — use `useTranslation()` instead.
- When adding a key to `en`, add the equivalent key to every other language file in the same commit.
  If a real translation is not yet available, copy the English value verbatim as a placeholder —
  this keeps all files structurally identical and gives translators a clear starting point. Do not
  omit the key; a missing key is harder to discover than an untranslated one.
- When removing a UI string, delete its key from **every** language file in the same commit. Search
  for the key literal across `public/locales/` to find all copies. Dead keys accumulate silently and
  make future audits harder.
- When reviewing a PR that touches locale files or translatable components, verify: every key added
  to `en` has a counterpart in all other language files; every key removed from `en` is also removed
  from all other language files; no key exists only in a non-English file (orphan keys with no `en`
  counterpart).

## Accessibility Guidelines

Accessibility is a critical requirement for all UI components. Prioritize accessibility from the
start, not as an afterthought.

**Required Attributes:**

- Use semantic HTML elements (`<nav>`, `<main>`, `<header>`, `<footer>`, `<button>`, etc.)
- Add `aria-label` or `aria-labelledby` to icon-only buttons and interactive elements
- Include `role` attributes when semantic HTML isn't sufficient (e.g., `role="img"` for decorative
  SVGs)
- Provide text alternatives for images and icons using `aria-label` or `alt` attributes

**Interactive Elements:**

- Ensure all interactive elements are keyboard accessible
- Maintain visible focus indicators
- Use proper button elements (`<button>`) instead of div/span with click handlers
- Support both mouse and keyboard interactions
- **Toggle buttons MUST use `aria-pressed`** to indicate their state (`aria-pressed="true"` when
  active, `aria-pressed="false"` when inactive)
- Filter buttons, favorite buttons, or any button that maintains a pressed/unpressed state requires
  `aria-pressed`

**Form Controls:**

- Always associate labels with form inputs using `htmlFor` and `id`
- Provide clear placeholder text or helper text for complex inputs
- Use `aria-invalid` and `aria-describedby` for error states
- Group related form controls with `<fieldset>` and `<legend>`

**Examples:**

```tsx
// Good: Icon button with accessible label
<button aria-label="Close menu">
  <XIcon />
</button>

// Good: Toggle button with state
<button
  aria-pressed={isActive}
  onClick={() => setIsActive(!isActive)}
>
  Filter by Spans
</button>

// Good: Decorative SVG with role
<svg role="img" aria-label="Animated compass">
  {/* ... */}
</svg>

// Good: Form input with label
<label htmlFor="search" className="text-sm font-medium">
  Search
</label>
<input
  id="search"
  type="text"
  aria-label="Search instrumentations"
  placeholder="Search..."
/>

// Good: Link with meaningful text
<Link to="/java-agent" aria-label="View Java Agent instrumentation explorer">
  Java Agent
</Link>
```

**Testing:**

- Verify components work with keyboard navigation (Tab, Enter, Space, Arrow keys)
- Test with screen readers when implementing complex interactions
- Use semantic HTML and ARIA attributes appropriately (not excessively)
- Test all interactive states (hover, focus, active, disabled) for proper feedback

**Code Review Checklist:**

When reviewing UI components, always verify:

- [ ] All interactive elements have appropriate ARIA attributes
- [ ] Toggle buttons use `aria-pressed`
- [ ] Icon-only buttons have `aria-label`
- [ ] Form inputs are properly labeled
- [ ] Keyboard navigation works correctly
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA standards (use browser dev tools to verify)

## Footguns

- `bun run build` runs typecheck first; strict TypeScript blocks builds on unused locals or
  parameters.
- Route params are unvalidated. Pages must validate URL params and handle missing data gracefully.

## Before finishing

Run before submitting changes:

- `bun run typecheck`
- `bun run lint`
- `bun run test`

If your change added, removed, or renamed any locale keys: verify that every language file under
`public/locales/` has the same key structure as `en`. Every key present in `en` must exist in all
other language files, and no orphan keys should exist only in a non-English file.
