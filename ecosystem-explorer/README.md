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
├── components/ # Shared components
│ ├── layout/ # Header, Footer
│ ├── ui/ # Reusable UI components (buttons, cards, etc.)
│ └── icons/ # SVG icon components
├── features/ # Feature-based modules
│ ├── home/ # Home page
│ ├── java-agent/ # Java Agent explorer
│ ├── collector/ # Collector explorer
│ └── not-found/ # 404 page
├── lib/ # Utilities and data layer
│ ├── api/ # Data layer
│ │ ├── idb-cache.ts # IndexedDB persistence
│ │ └── javaagent-data.ts # Data fetching with cache
│ └── feature-flags.ts # Feature flag utility
├── hooks/ # React hooks
│ └── use-javaagent-data.ts # Data hooks for components
└── types/ # TypeScript type definitions
│ └── javaagent.ts # Java Agent data types
```

<!-- markdownlint-enable MD010 -->

## Feature Flags

Feature flags are controlled via [Vite environment variables](https://vite.dev/guide/env-and-mode)
prefixed with `VITE_FEATURE_FLAG_`. They are evaluated at build time.

**Enabling a flag locally:**

Update `.env.development` file and set the flag to `true`, `1`, or `yes`:

```bash
VITE_FEATURE_FLAG_JAVA_CONFIG_BUILDER=true
```

For example, setting `VITE_FEATURE_FLAG_JAVA_CONFIG_BUILDER` to `true` makes the Java Config Builder
visible, while setting it to `false` hides it.

**Using a flag in code:**

```tsx
import { isEnabled } from "@/lib/feature-flags";

{
  isEnabled("JAVA_CONFIG_BUILDER") && <MyComponent />;
}
```

The available feature flags are defined in `src/lib/feature-flags.ts`.

**Deployment behavior:**

Branch deploys and deploy previews enable both current feature flags through `netlify.toml`.
Production does not enable them by default.

## Data Fetching and Caching

We use IndexedDB as a cache to minimize network requests and build a db in the browser. The data
layer consists of three main parts:

1. IDB Cache (`src/lib/api/idb-cache.ts`) - Browser-persistent storage with two object stores:
   `metadata` (versions, manifests) and `instrumentations` (content-addressed data)

2. Data API (`src/lib/api/javaagent-data.ts`) - Fetching layer that checks IndexedDB first, falls
   back to network, and caches responses.

3. React Hooks (`src/hooks/use-javaagent-data.ts`) - Component integration with loading/error states

**Example usage:**

```tsx
const versions = useVersions();
const instrumentations = useInstrumentations(version);
```

## Theme System

Theme colors are defined in `src/themes.ts` and applied via CSS custom properties. Use them in your
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
<div style={{ color: "hsl(var(--color-primary))" }}>Custom styled element</div>
```

**Available colors:**

- `primary` - Vibrant orange accent
- `secondary` - Bright blue accent
- `background` - Main background
- `foreground` - Main text
- `card` - Card backgrounds
- `card-secondary` - Secondary card backgrounds
- `muted-foreground` - Secondary text
- `border` - Border colors
