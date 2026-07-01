# Ecosystem Explorer Website

React/Vite web application for exploring the OpenTelemetry ecosystem registry data.

## Getting Started

Install dependencies:

```bash
bun install
```

Run development server:

```bash
bun run serve
```

Build for production:

```bash
bun run build
```

Preview production build:

```bash
bun run preview
```

Run linter:

```bash
bun run lint
```

Format code:

```bash
bun run format
```

Check formatting:

```bash
bun run format:check
```

Run tests:

```bash
bun run test
```

## Project Structure

<!-- markdownlint-disable MD010 -->

```text
src/
├── App.tsx # Reads the V1_REDESIGN flag and renders LegacyApp or v1/V1App
├── LegacyApp.tsx # Default app shell and route table (Header/Footer chrome)
├── components/ # Shared components
│ ├── layout/ # Header (incl. theme + language switchers), Footer
│ ├── ui/ # Reusable UI components (wrapped Radix primitives)
│ └── icons/ # SVG icon components
├── features/ # Feature-based modules
│ ├── home/ # Home page
│ ├── java-agent/ # Java Agent explorer (incl. configuration builder)
│ ├── collector/ # Collector explorer
│ ├── about/ # About page
│ └── not-found/ # 404 page
├── lib/ # Utilities and data layer
│ ├── api/ # Data layer
│ │ ├── idb-cache.ts # IndexedDB persistence (object stores + schema version)
│ │ ├── fetch-with-cache.ts # Shared cache-then-network fetch helper
│ │ ├── javaagent-data.ts # Java Agent data fetching
│ │ ├── collector-data.ts # Collector data fetching
│ │ └── configuration-data.ts # Declarative configuration data fetching
│ └── feature-flags.ts # Feature flag utility
├── hooks/ # Cross-feature React hooks (data state, configuration builder, etc.)
├── i18n/ # i18next runtime config (config.ts)
├── styles/ # Global CSS and design tokens (tokens.css, base.css, syntax.css)
├── theme-context.tsx # Theme provider (light / dark / auto)
├── themes.ts # Typed reference for the color tokens
├── types/ # TypeScript type definitions
│ ├── javaagent.ts # Java Agent data types
│ ├── collector.ts # Collector data types
│ ├── configuration.ts # Configuration schema types
│ └── configuration-builder.ts # Configuration builder types
└── v1/ # In-progress v1 redesign (gated behind V1_REDESIGN)
```

<!-- markdownlint-enable MD010 -->

## Feature Flags

Feature flags are controlled via [Vite environment variables](https://vite.dev/guide/env-and-mode)
prefixed with `VITE_FEATURE_FLAG_`. They are evaluated at build time.

**Enabling a flag locally:**

Update `.env.development` file and set the flag to `true`, `1`, or `yes`:

```bash
VITE_FEATURE_FLAG_COLLECTOR_PAGE=true
```

For example, setting `VITE_FEATURE_FLAG_COLLECTOR_PAGE` to `true` makes the Collector Page visible,
while setting it to `false` hides it.

**Using a flag in code:**

```tsx
import { isEnabled } from "@/lib/feature-flags";

{
  isEnabled("COLLECTOR_PAGE") && <MyComponent />;
}
```

The available feature flags are defined in `src/lib/feature-flags.ts`:

- `COLLECTOR_PAGE` — exposes the Collector page
- `V1_REDESIGN` — switches the app to the in-progress v1 redesign (`src/v1/`)
- `DEV_SHOWCASE` — enables the `/_dev/components` component showcase route

**Deployment behavior:**

Branch deploys and deploy previews enable `COLLECTOR_PAGE` through `netlify.toml`. `V1_REDESIGN` is
enabled automatically on `feat/84-*` branches via the build command. Production enables none of
these flags by default.

## Data Fetching and Caching

We use IndexedDB as a cache to minimize network requests and build a db in the browser. The data
layer consists of three main parts:

1. IDB Cache (`src/lib/api/idb-cache.ts`) - Browser-persistent storage with four object stores:
   `metadata` (versions, manifests), `instrumentations` (content-addressed data), `configuration`
   (declarative configuration schema data), and `global-configurations`. Bump `DB_VERSION` when
   changing the schema.

2. Data APIs (`src/lib/api/`) - Per-ecosystem fetching layers (`javaagent-data.ts`,
   `collector-data.ts`, `configuration-data.ts`) built on the shared `fetch-with-cache.ts` helper,
   which checks IndexedDB first, falls back to network, and caches responses.

3. React Hooks (`src/hooks/`) - Component integration with loading/data/error state, e.g.
   `use-javaagent-data.ts`, `use-collector-data.ts`, `use-configuration-data.ts`

**Example usage:**

```tsx
const versions = useVersions();
const instrumentations = useInstrumentations(version);
```

## Theme System

Color tokens are defined as CSS custom properties in `src/styles/tokens.css` (the source of truth),
with `src/themes.ts` providing a typed reference for use in TypeScript. Tokens follow an `--*-hsl`
naming convention and are split per `[data-theme="dark"]` / `[data-theme="light"]`. Use them in your
components:

**In JSX with Tailwind classes:**

```tsx
<div className="bg-background text-foreground border-border border">
  <span className="text-primary">Primary color</span>
  <span className="text-secondary">Secondary color</span>
</div>
```

**With inline styles:**

```tsx
<div style={{ color: "hsl(var(--primary-hsl))" }}>Custom styled element</div>
```

**Available colors:**

- `primary` - OTel blue (structural / navbar / buttons); maps to `--otel-blue-hsl`
- `secondary` - OTel orange (accents / hover / CTAs); maps to `--otel-orange-hsl`
- `background` - Main background
- `foreground` - Main text
- `card` - Card backgrounds
- `card-secondary` - Secondary card backgrounds
- `muted-foreground` - Secondary text
- `border` - Border colors
