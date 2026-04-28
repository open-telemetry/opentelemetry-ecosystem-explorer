# AGENTS.md

## Component Architecture

### ecosystem-registry

Stores versioned history of metadata for each project. This component maintains historical records of project metadata
over time.

### ecosystem-automation

Handles automated data collection and synchronization:

- Runs scheduled pipelines to collect and aggregate metadata from various projects
- Updates the registry with new metadata

### ecosystem-explorer

React/Vite web application that provides search and exploration capabilities for the OpenTelemetry ecosystem. Built
with TypeScript, React 19, and Vite.

IMPORTANT: reference ecosystem-explorer/DESIGN.md for detailed architecture and development guidelines for the explorer
component.

#### Architecture

**UI Framework**: React 19 with Vite for fast development and building. Uses SWC for fast TypeScript compilation.

**Styling**: Tailwind CSS v4 with a custom design system. Components follow a landing page structure with sections
(HeroSection, ExploreSection) and reusable cards (NavigationCard). Uses Radix UI primitives for accessible components.

**Path Aliases**: The `@/` alias maps to `src/`, configured in both `vite.config.ts` and `tsconfig.app.json`. Always
use `@/` for imports within the src directory (e.g., `@/components/hero-section.tsx`).

**Testing**: Vitest with jsdom environment and React Testing Library. Test setup file at `src/test/setup.ts` imports
jest-dom matchers.

**Website Structure**: Landing page with navigation to two main areas:

- `/java-agent`: Java Agent instrumentation explorer
- `/collector`: Collector component explorer

#### Accessibility Guidelines

**IMPORTANT**: Accessibility is a critical requirement for all UI components. When generating or reviewing components,
always prioritize accessibility from the start, not as an afterthought.

All components must follow accessibility best practices:

**Required Attributes:**

- Use semantic HTML elements (`<nav>`, `<main>`, `<header>`, `<footer>`, `<button>`, etc.)
- Add `aria-label` or `aria-labelledby` to icon-only buttons and interactive elements
- Include `role` attributes when semantic HTML isn't sufficient (e.g., `role="img"` for decorative SVGs)
- Provide text alternatives for images and icons using `aria-label` or `alt` attributes

**Interactive Elements:**

- Ensure all interactive elements are keyboard accessible
- Maintain visible focus indicators
- Use proper button elements (`<button>`) instead of div/span with click handlers
- Support both mouse and keyboard interactions
- **Toggle buttons MUST use `aria-pressed`** to indicate their state (`aria-pressed="true"` when active,
  `aria-pressed="false"` when inactive)
- Filter buttons, favorite buttons, or any button that maintains a pressed/unpressed state requires `aria-pressed`

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

## GitHub Actions Best Practices

When working with GitHub Actions in this repository:

- **Always pin actions to specific commit SHAs** for security (helps to prevent supply chain attacks)
- **Verify SHA authenticity** before using - check the actual repository to ensure the SHA exists and corresponds to
  the intended version
- **Never generate or guess SHAs** - always look up the correct SHA from the action's repository
- **Include version comments** alongside SHAs for readability (e.g., `# v4.1.0`)
- **Format**: `uses: owner/action@<full-sha> # vX.Y.Z`

Example:

```yaml
- uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
```

## Code Style

### Comments and Documentation

Avoid adding unnecessary emojis whenever possible. If there is an error or a warning that you are adding an emoji to,
it could be justified, but don't just add emojis for decoration.

Avoid redundant comments for obvious code. Only add comments when they provide non-obvious information:

**When to add comments:**

- ✅ Public API methods (docstrings required)
- ✅ Non-obvious logic or workarounds
- ✅ Complex algorithms that aren't self-explanatory
- ✅ Edge cases or gotchas that aren't immediately clear

**When NOT to add comments:**

- ❌ Obvious operations where the method/variable name is clear
- ❌ Simple getters, setters, or straightforward logic
- ❌ Comments that just restate what the code does
- ❌ Comments on test methods that just describe the test name

When writing markdown using code blocks, always specify the language for syntax highlighting (e.g., `python`, `yaml`,
`tsx`).


When adding imports, always do it at the top of the file unless there is a specific reason to do otherwise (e.g., to
avoid circular dependencies), and in those cases, explain with a comment.
