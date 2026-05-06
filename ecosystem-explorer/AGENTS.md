# AGENTS.md — ecosystem-explorer

React 19 + Vite + TypeScript frontend that provides search and exploration for the OpenTelemetry
ecosystem. Tailwind CSS v4 for styling, Radix UI primitives, Vitest for unit tests, Playwright for
integration tests.

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
- `bun run test:integration` — Playwright-based integration tests

## Project structure

- `src/features/{feature}/` — Feature-scoped pages, components, hooks, utils. Tests sit alongside
  source.
- `src/components/ui/` — Wrapped Radix UI primitives. Use these instead of importing Radix directly.
- `src/components/layout/` — Shared layout components.
- `src/hooks/` — Cross-feature hooks.
- `src/lib/` — Utilities, feature flags, theme tokens.

The `@/` import alias maps to `src/`. Always use `@/` for intra-`src` imports.

Routes are registered centrally in `App.tsx`. To add a feature route: create a `*-page.tsx` under
`src/features/{feature}/`, then register a `<Route>` in `App.tsx`. The header and footer wrap all
routes globally, so do not duplicate them per page.

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
