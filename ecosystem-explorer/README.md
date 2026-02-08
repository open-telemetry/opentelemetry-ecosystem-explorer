# Ecosystem Explorer Website

React/Vite web application for exploring the OpenTelemetry ecosystem registry data.

## Getting Started

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Run linter:

```bash
npm run lint
```

Format code:

```bash
npm run format
```

Check formatting:

```bash
npm run format:check
```

Run tests:

```bash
npm test
```

## Project Structure

<!-- markdownlint-disable MD010 -->
```markdown
src/
├── components/                   # Shared components
│   ├── layout/                   # Header, Footer
│   ├── ui/                       # Reusable UI components (buttons, cards, etc.)
│   └── icons/                    # SVG icon components
├── features/                     # Feature-based modules
│   ├── home/                     # Home page
│   ├── java-agent/               # Java Agent explorer
│   ├── collector/                # Collector explorer
│   └── not-found/                # 404 page
├── lib/api/                      # Data layer
│   ├── idb-cache.ts              # IndexedDB persistence
│   └── javaagent-data.ts         # Data fetching with cache
├── hooks/                        # React hooks
│   └── use-javaagent-data.ts     # Data hooks for components
└── types/                        # TypeScript type definitions
    └── javaagent.ts              # Java Agent data types
```
<!-- markdownlint-enable MD010 -->

## Data Layer

The data layer uses a two-tier caching strategy to minimize network requests:

1. IDB Cache (`src/lib/api/idb-cache.ts`) - Browser-persistent storage with two object stores: `metadata` (versions,
   manifests) and `instrumentations` (content-addressed data)

2. Data API (`src/lib/api/javaagent-data.ts`) - Fetching layer that checks IndexedDB first, falls back to network, and
   caches responses. Includes request deduplication to prevent duplicate fetches.

3. React Hooks (`src/hooks/use-javaagent-data.ts`) - Component integration with loading/error states

**Example usage:**

```tsx
const versions = useVersions();
const instrumentations = useInstrumentations(version);
```

## Theme System

Theme colors are defined in `src/themes.ts` and applied via CSS custom properties. Use them in your components:

**In JSX with Tailwind classes:**

```tsx
<div className="bg-background text-foreground border border-border">
    <span className="text-primary">Primary color</span>
    <span className="text-secondary">Secondary color</span>
</div>
```

**With inline styles:**

```tsx
<div style={{color: 'hsl(var(--color-primary))'}}>
    Custom styled element
</div>
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
