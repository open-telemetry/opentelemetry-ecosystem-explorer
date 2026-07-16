# SEO and Agent Delivery

How the static web app serves rich, per-page metadata and content to non-browser clients — search
engines, social scrapers, and HTTP-only AI agents that never execute the React SPA.

## Overview

The ecosystem-explorer ships as a static SPA: the server returns the same empty `index.html` shell
for every route, and React fills in the content in the browser. That shell is invisible to clients
that don't run JavaScript — a crawler or an AI agent fetching a component URL would see a bare page
with a generic title and no body.

To fix this without adding a backend, the app precomputes per-route metadata and Markdown at build
time and rewrites the shell at the edge on each request. Three layers cooperate, all deriving their
text from one shared source so they never disagree:

```text
src/lib/seo/  ──►  build scripts   ──►  dist/ static artifacts (routes.json, *.md, sitemap.xml, llms.txt)
   (shared)  ──►  <Seo> component  ──►  client-side <head> updates (browsers, JS-capable crawlers)
   (mirror)  ──►  edge function    ──►  per-request <head> + body injection (non-JS crawlers, agents)
```

This complements the [Agent Readiness](./AGENT_READINESS.md) standards (`llms.txt`, JSON schemas,
structured metadata), which describe _what_ agents consume; this document describes _how_ it is
generated and delivered.

## Shared metadata derivation

`ecosystem-explorer/src/lib/seo/` is the single source of truth for per-URL titles, descriptions,
and canonical paths.

- `constants.ts` — site origin, name, default title/description, default social image.
- `derive.ts` — `STATIC_ROUTE_META` (fixed routes) plus pure functions that derive metadata and
  canonical paths for Collector component and Java instrumentation detail pages.

This module is **intentionally dependency-free** because it runs in three different runtimes: the
Bun build scripts, the Vite/React client, and the Netlify Deno edge function. Do not import
framework, Node, or Deno APIs here.

> [!IMPORTANT] The edge function runs in Deno and cannot import from `src/`, so it **duplicates** a
> few constants (site origin, default title/description). When you change those constants, update
> the copy in `netlify/edge-functions/agent-negotiation.ts` in the same commit.

SEO strings are deliberately **not** routed through i18next — localized SEO/URLs are out of scope,
so this module is English-only.

## Build-time generation

The production build (`bun run build`) runs the generators after `vite build`, in order:

| Script                    | Emits                                                                                                     | Purpose                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `generate-schemas.mjs`    | `public/schemas/*.schema.json`                                                                            | JSON schemas from TypeScript types (see Agent Readiness)             |
| `generate-agent-docs.mjs` | `dist/llms.txt`, `dist/llms-full.txt`, `dist/agent/**/*.md`, per-route and per-detail-page `dist/**/*.md` | Markdown documentation for AI agents                                 |
| `generate-seo.mjs`        | `dist/seo/routes.json`, `dist/sitemap.xml`                                                                | Per-route metadata manifest (for the edge) and the crawlable URL set |

### Markdown pages

`generate-agent-docs.mjs` writes a Markdown file at each app-route path so that appending `.md` (or
requesting `text/markdown`) yields real content:

- Static routes → `dist/{route}.md` (e.g. `/collector.md`, `/about.md`).
- Collector components → `dist/collector/components/{distribution}/{name}.md`.
- Java instrumentations → `dist/java-agent/instrumentation/{name}.md`.
- Section indexes → `dist/agent/collector/index.md`, `.../versions.md`, and the javaagent
  equivalents.
- `llms.txt` (concise index) and `llms-full.txt` (index plus inlined section content).

Detail pages are generated for the **latest** version only. The Markdown uses a constrained subset
(headings, blockquotes, lists, GFM tables, inline bold/code/links) because the edge function
re-parses it with a minimal converter — see below.

### SEO manifest and sitemap

`generate-seo.mjs` writes:

- `dist/seo/routes.json` — canonical pathname → `{ title, description }` for every static route and
  every latest-version detail page. The edge function reads this to inject per-page metadata.
- `dist/sitemap.xml` — the full crawlable URL set (app routes plus machine-readable doc resources
  such as `llms.txt` and the schemas), absolute against the production origin.

## Client-side SEO

`src/components/seo/seo.tsx` (`<Seo>`) imperatively syncs the document title, description, canonical
link, and Open Graph / Twitter tags for the current route. This is the layer browsers and
JS-rendering crawlers (e.g. Googlebot) see. It resolves the same values as the edge function via the
shared `src/lib/seo` helpers, so a JS render and a non-JS fetch of the same URL agree.

## Edge function

`ecosystem-explorer/netlify/edge-functions/agent-negotiation.ts` runs on `/*` (see `netlify.toml`)
and is the delivery layer for non-JS clients. It:

- **Negotiates content** — a request with `Accept: text/markdown` is served the route's generated
  `.md` (falling back to the section index, then `llms.txt`).
- **Serves documentation assets** with correct content types and strict 404s — `llms.txt`,
  `/agent/**` Markdown, `/schemas` and `/data` JSON, `sitemap.xml`, and `robots.txt`. Passing
  through a conditional revalidation status (304) untouched is important; collapsing it to 404
  breaks data loading.
- **Rewrites the HTML shell per route** — for page navigations it looks the path up in `routes.json`
  and injects a route-specific title, description, canonical link, Open Graph / Twitter tags, a
  Markdown `alternate` link, and JSON-LD.
- **Injects real body content** — it renders the route's generated Markdown into the empty `#root`
  (visually hidden and `aria-hidden` so human visitors never see it), so HTTP-only agents receive
  actual page content instead of an empty shell.
- **Returns real 404s** for paths absent from the manifest, so crawlers don't index soft 404s.
  Parameterized routes that resolve client-side (versioned lists, instrumentation version routes)
  are allow-listed as known. If the manifest fails to load, every page is treated as known to avoid
  false 404s.

## Deployment wiring

`netlify.toml` (repo root) registers the edge function on `/*`, applies the SPA catch-all redirect
to `/index.html`, and sets security headers. The preview and production build commands both run the
full generator chain, so previews exercise the same edge behavior as production.

## Contributor guidance

- **Adding a route** — add its metadata to `STATIC_ROUTE_META` in `src/lib/seo/derive.ts` so the
  generators, the client, and the edge all produce metadata and a Markdown page for it. (This is in
  addition to registering the `<Route>` in both `LegacyApp.tsx` and `V1App.tsx`.)
- **Rendering `<Seo>`** — pages that need non-default metadata (especially detail pages) should
  render `<Seo>` with the derived values.
- **Changing shared constants** — mirror the change in the edge function's duplicated constants.
- **Keep `src/lib/seo` dependency-free** — it must import cleanly in Bun, the browser, and Deno.
- **Verifying** — after changing generation or edge logic, run `bun run build` and inspect the
  `dist/` artifacts (`seo/routes.json`, `sitemap.xml`, `llms.txt`, the `.md` pages). The edge
  function has unit tests under `netlify/edge-functions/__tests__/`.
