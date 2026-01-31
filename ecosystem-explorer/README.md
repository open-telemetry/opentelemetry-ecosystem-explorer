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

```markdown
src/
├── components/         # Shared components
│   ├── layout/         # Header, Footer
│   ├── ui/             # Reusable UI components (buttons, cards, etc.)
│   └── icons/          # SVG icon components
└──features/           # Feature-based modules
    ├── home/           # Home page
    ├── java-agent/     # Java Agent explorer
    ├── collector/      # Collector explorer
    └── not-found/      # 404 page
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
<div style={{ color: 'hsl(var(--color-primary))' }}>
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
