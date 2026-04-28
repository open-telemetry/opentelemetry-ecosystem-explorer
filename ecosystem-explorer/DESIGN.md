# Design System

This document outlines the design principles, patterns, and tokens used in the OpenTelemetry Ecosystem Explorer. It
serves as a guide for AI agents and developers working on UI elements to ensure visual consistency and quality.

## Overview

The Ecosystem Explorer uses a **dark-first design system** optimized for readability and visual hierarchy. The design
emphasizes:

- **Depth through subtlety** - Layered backgrounds, soft shadows, and ambient glows
- **Clarity first** - Clear information hierarchy through color, spacing, and typography
- **Consistent motion** - Unified animation timing and easing
- **Accessibility** - WCAG AA compliance with proper contrast and semantic markup

---

## Design Principles

### 1. Depth Through Subtlety

Create visual depth without overwhelming the interface:

- Use layered backgrounds (base -> pattern -> content -> overlay)
- Apply soft shadows and glows to establish elevation
- Employ subtle gradients for ambient lighting effects
- Keep depth cues understated - they should guide the eye, not dominate

### 2. Clarity First

Information hierarchy guides users naturally:

- Primary actions use the vibrant orange (`--color-primary`)
- Secondary information uses the blue accent (`--color-secondary`)
- Background elements recede through lower contrast
- Whitespace provides visual breathing room

### 3. Consistent Motion

All animations follow a unified timing system:

- Default transition: `300ms ease-in-out`
- Micro-interactions: `200ms ease-out`
- Complex animations: `400ms ease-in-out`
- Use `transform` and `opacity` for performant animations

### 4. Dark-First Design

Optimized for extended viewing in low-light environments:

- Deep navy base (`--color-background`)
- Bright, high-contrast text (`--color-foreground`)
- Reduced blue light through warm accent colors
- Subtle glows instead of harsh borders

---

## Color System

### HSL Token Reference

All colors are defined using HSL values in `src/themes.ts`. They are applied via CSS custom properties:

```css
--color-primary: 38 95% 52%; /* Vibrant orange */
--color-secondary: 228 60% 55%; /* Brighter blue */
--color-background: 232 38% 15%; /* Deep navy */
--color-foreground: 210 45% 99%; /* Bright white with blue hint */
--color-card: 232 35% 19%; /* Card background */
--color-card-secondary: 232 32% 23%; /* Card hover state */
--color-muted: 232 30% 17%; /* Darker background for code/badges */
--color-muted-foreground: 220 22% 65%; /* Muted text */
--color-border: 232 28% 26%; /* Borders */
```

### Usage Guidelines

#### Primary (Orange)

- Primary CTAs and important actions
- Links and interactive elements
- Accent highlights and focus states
- Sparingly used to draw attention

#### Secondary (Blue)

- Secondary actions and information
- Decorative accents and gradients
- Category indicators
- Complements primary without competing

#### Background Layers

- `background` - Page base
- `card` - Elevated surfaces (cards, panels)
- `card-secondary` - Hover states and nested cards
- `muted` - Darker backgrounds for inline code, type badges, and subtle UI elements
- `border` - Dividers and outlines

#### Text Hierarchy

- `foreground` - Primary text (headings, body)
- `muted-foreground` - Secondary text (captions, labels)
- Lower opacity variants - Tertiary text

---

## Depth and Elevation

### Shadow Scale

Shadows establish elevation and focus:

```css
--shadow-sm: 0 1px 2px 0 hsl(0 0% 0% / 0.05);
--shadow-md: 0 4px 6px -1px hsl(0 0% 0% / 0.1);
--shadow-lg: 0 10px 15px -3px hsl(0 0% 0% / 0.1);
```

### Glow Effects

Glows create ambient lighting and highlight interactive elements:

```css
--glow-primary: 0 0 40px hsl(var(--primary-hsl) / 0.15);
--glow-secondary: 0 0 40px hsl(var(--secondary-hsl) / 0.15);
```

**Usage patterns:**

- Primary glow: Hero elements, important features
- Secondary glow: Decorative accents, section transitions
- Hover states: Increase opacity to 0.25 for prominence

### Layering Strategy

Visual layers from back to front:

1. **Background** - Solid color or subtle gradient
2. **Pattern** - Grid or texture overlay (low opacity)
3. **Content** - Cards, text, images
4. **Overlay** - Glows, shadows, focus rings

---

## Component Patterns

### Cards

Standard card pattern for elevated content:

**Structure:**

```tsx
<div className="border-border bg-card hover:bg-card-secondary relative overflow-hidden rounded-lg border p-6 transition-all duration-300">
  {/* Grid pattern background */}
  <div className="absolute inset-0 opacity-20">
    <div className="grid-pattern" />
  </div>

  {/* Content */}
  <div className="relative z-10">{children}</div>

  {/* Corner accent */}
  <div className="from-primary/10 absolute top-0 right-0 h-16 w-16 bg-gradient-to-br to-transparent" />
</div>
```

**Hover states:**

- Transition to `bg-card-secondary`
- Add `shadow-[0_0_20px_hsl(var(--primary-hsl)/0.1)]`
- Slight scale animation: `hover:scale-[1.02]`

### Buttons

Three button variants:

**Primary:**

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 font-medium transition-all">
  Action
</button>
```

**Secondary:**

```tsx
<button className="border-border hover:bg-card rounded-lg border bg-transparent px-4 py-2 font-medium transition-all">
  Action
</button>
```

**Ghost:**

```tsx
<button className="hover:bg-card rounded-lg px-4 py-2 font-medium transition-all">Action</button>
```

### Type Badges

Small badges used to display types, categories, or status indicators:

```tsx
<span className="bg-muted/50 text-foreground/70 inline-block w-fit rounded px-2 py-1 text-xs font-bold">
  {type}
</span>
```

**Usage:**

- Attribute types in tables (string, int, boolean, etc.)
- Metric types
- Span kinds
- Other categorical indicators

**Styling:**

- `bg-muted/50` - Semi-transparent dark background for subtle contrast
- `text-foreground/70` - Slightly dimmed text for readability on dark background
- `text-xs font-bold` - Small, bold text for compact display
- `rounded px-2 py-1` - Consistent padding and border radius

**Color variants:**
For semantic meaning with glowing effects, use GlowBadge component:

- `variant="success"` - Green for metrics
- `variant="info"` - Blue for spans
- `variant="warning"` - Yellow for warnings
- `variant="error"` - Red for errors

### Inline Code Elements

Code snippets and technical values displayed inline:

```tsx
<code className="bg-muted text-foreground/80 rounded px-2 py-1 text-sm">{value}</code>
```

**Usage:**

- Unit values (ms, bytes, etc.)
- Configuration keys
- API endpoints
- Version numbers
- Short code snippets

**Styling:**

- `bg-muted` - Full opacity dark background for strong contrast
- `text-foreground/80` - Slightly dimmed bright text for comfortable reading
- `text-sm` - Readable size for technical content
- `rounded px-2 py-1` - Consistent padding matching type badges

**Guidelines:**

- Add `font-mono` class for actual code readability when needed
- Use `break-all` for long technical strings that need to wrap
- Maintain consistent padding (`px-2 py-1`) across all inline code elements

### Striped Tables

Alternating row backgrounds for improved readability in data tables:

```tsx
<table className="w-full border-collapse">
  <tbody>
    {items.map((item, index) => (
      <tr key={item.id} className={index % 2 === 1 ? "bg-muted/40" : ""}>
        <td>{item.content}</td>
      </tr>
    ))}
  </tbody>
</table>
```

**Pattern:**

- Apply `bg-muted/40` to odd rows (index % 2 === 1)
- Keep even rows with default transparent background
- Use 40% opacity for visible striping that improves readability
- Combine with borders for clear table structure

**Complete table example:**

```tsx
<div className="border-border/30 overflow-hidden rounded-lg border">
  <table className="w-full border-collapse">
    <thead>
      <tr className="bg-white/5">
        <th className="text-muted-foreground p-3 text-left text-[10px] font-bold tracking-widest uppercase">
          Column
        </th>
      </tr>
    </thead>
    <tbody>
      {items.map((item, index) => (
        <tr key={item.id} className={index % 2 === 1 ? "bg-muted/40" : ""}>
          <td className="p-4">{item.content}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Sections

Page sections with consistent spacing:

```tsx
<section className="border-border/50 border-t py-12 md:py-16">
  {/* Optional section label with decorative lines */}
  <div className="mb-8 flex items-center justify-center gap-4">
    <div className="to-border h-px w-16 bg-gradient-to-r from-transparent" />
    <h2 className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
      Section Title
    </h2>
    <div className="to-border h-px w-16 bg-gradient-to-l from-transparent" />
  </div>

  {/* Content */}
</section>
```

---

## Animation Guidelines

### Timing Functions

```css
ease-out     /* Element entering (200ms) */
ease-in-out  /* Default (300ms) */
ease-in      /* Element exiting (200ms) */
```

### Common Animation Patterns

**Fade in:**

```tsx
<div className="animate-in fade-in duration-300">{content}</div>
```

**Slide up:**

```tsx
<div className="animate-in slide-in-from-bottom-4 duration-300">{content}</div>
```

**Scale on hover:**

```tsx
<div className="transition-transform duration-200 hover:scale-105">{content}</div>
```

**Staggered children:**
Use increasing delay values:

```tsx
<div className="animate-in fade-in duration-300 delay-0">{child1}</div>
<div className="animate-in fade-in duration-300 delay-100">{child2}</div>
<div className="animate-in fade-in duration-300 delay-200">{child3}</div>
```

---

## Typography Scale

### Font Stack

```css
font-family: ui-sans-serif, system-ui, sans-serif;
```

### Size Scale

- `text-xs`: 0.75rem (12px) - Fine print, labels
- `text-sm`: 0.875rem (14px) - Secondary text, captions
- `text-base`: 1rem (16px) - Body text
- `text-lg`: 1.125rem (18px) - Subheadings
- `text-xl`: 1.25rem (20px) - Section headings
- `text-2xl`: 1.5rem (24px) - Page headings
- `text-3xl`: 1.875rem (30px) - Large headings
- `text-4xl`: 2.25rem (36px) - Hero text

### Weight Conventions

- `font-normal` (400): Body text
- `font-medium` (500): Emphasized text, labels
- `font-semibold` (600): Subheadings, buttons
- `font-bold` (700): Primary headings

---

## Spacing System

Use Tailwind's spacing scale consistently:

- **Micro spacing**: `gap-1` (4px), `gap-2` (8px)
- **Component spacing**: `gap-4` (16px), `gap-6` (24px)
- **Section spacing**: `py-8` (32px), `py-12` (48px), `py-16` (64px)
- **Container padding**: `px-4` (16px), `md:px-8` (32px)

**Responsive patterns:**

```tsx
<div className="gap-4 md:gap-6 lg:gap-8"> /* Grows with viewport */
    <div className="py-8 md:py-12 lg:py-16"> /* More vertical space on larger screens */
```

---

## Grid Patterns

Decorative grid patterns for visual texture:

**Small grid (20px):**

```css
background-image:
  linear-gradient(hsl(var(--border-hsl)) 1px, transparent 1px),
  linear-gradient(90deg, hsl(var(--border-hsl)) 1px, transparent 1px);
background-size: 20px 20px;
```

**Large grid (40px):**

```css
background-image:
  linear-gradient(hsl(var(--border-hsl)) 1px, transparent 1px),
  linear-gradient(90deg, hsl(var(--border-hsl)) 1px, transparent 1px);
background-size: 40px 40px;
```

Apply at low opacity (10-20%) for subtle texture.

---

## Accessibility

All components must follow accessibility best practices as outlined in `AGENTS.md`. Key requirements:

- Semantic HTML elements
- ARIA labels for icon-only buttons
- `aria-pressed` for toggle buttons
- Keyboard navigation support
- Visible focus indicators
- WCAG AA color contrast (4.5:1 for text, 3:1 for UI elements)

Refer to `AGENTS.md` for complete accessibility guidelines and code examples.

---

## Examples

### Hero Section Pattern

```tsx
<section className="relative overflow-hidden py-16 md:py-24">
  {/* Ambient radial gradient */}
  <div className="bg-gradient-radial from-primary/10 via-secondary/5 absolute inset-0 to-transparent" />

  {/* Grid pattern */}
  <div className="absolute inset-0 opacity-10">
    <div className="h-full w-full bg-[linear-gradient(hsl(var(--color-border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--color-border))_1px,transparent_1px)] bg-[size:40px_40px]" />
  </div>

  {/* Content */}
  <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
    <div className="mb-6 inline-flex rounded-full p-4 shadow-[0_0_60px_hsl(var(--color-primary)/0.2)]">
      <Icon className="h-16 w-16" />
    </div>
    <h1 className="text-4xl font-bold md:text-6xl">
      <span className="from-secondary to-primary bg-gradient-to-r bg-clip-text text-transparent">
        Gradient Title
      </span>
    </h1>
  </div>

  {/* Bottom fade */}
  <div className="from-background absolute right-0 bottom-0 left-0 h-24 bg-gradient-to-t to-transparent" />
</section>
```

### Navigation Card Pattern

```tsx
<Link
  to="/path"
  className="group border-border bg-card hover:bg-card-secondary relative overflow-hidden rounded-lg border p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_hsl(var(--color-primary)/0.1)]"
>
  {/* Grid pattern */}
  <div className="absolute inset-0 opacity-20">
    <div className="h-full w-full bg-[linear-gradient(hsl(var(--color-border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--color-border))_1px,transparent_1px)] bg-[size:20px_20px]" />
  </div>

  {/* Content */}
  <div className="relative z-10">
    <Icon className="text-primary mb-4 h-8 w-8" />
    <h3 className="text-xl font-semibold">Title</h3>
    <p className="text-muted-foreground mt-2">Description</p>
  </div>

  {/* Corner accent */}
  <div className="from-primary/10 group-hover:from-primary/20 absolute top-0 right-0 h-16 w-16 bg-gradient-to-br to-transparent transition-all duration-300" />
</Link>
```

---

## Tools and Resources

- **Tailwind CSS v4** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Color contrast checker** - Browser DevTools or [WebAIM](https://webaim.org/resources/contrastchecker/)
- **HSL color picker** - For creating consistent color variants

---

## Contributing

When adding new UI components:

1. Follow the design principles outlined above
2. Use existing color tokens from `src/themes.ts`
3. Implement hover and focus states for interactive elements
4. Verify accessibility (keyboard nav, ARIA labels, contrast)
5. Test responsive behavior across viewport sizes
6. Document any new patterns in this file
