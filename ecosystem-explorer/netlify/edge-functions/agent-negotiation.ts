/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Context } from "@netlify/edge-functions";

const notFound = () => new Response("Not Found", { status: 404 });

// Rewrites to a static asset and normalizes its Content-Type. Returns null when
// the rewrite resolves to the SPA HTML shell (the catch-all serves /index.html
// with status 200 for unknown paths), so the caller can 404. Any non-200 status
// is returned untouched — collapsing a 304 to 404 is what broke data loading on
// revalidation.
async function serveAsset(
  context: Context,
  path: string,
  contentType: string,
  extraHeaders?: Record<string, string>
): Promise<Response | null> {
  const response = await context.rewrite(path);
  if (response.status !== 200) {
    return response;
  }

  const originContentType = response.headers.get("content-type") ?? "";
  if (originContentType.includes("text/html")) {
    return null;
  }

  response.headers.set("Content-Type", contentType);
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    response.headers.set(key, value);
  }
  return response;
}

// Canonical production origin (mirrors SITE_ORIGIN in src/lib/seo/constants.ts).
// Duplicated here to keep the edge function self-contained in the Deno runtime.
const SITE_ORIGIN = "https://explorer.opentelemetry.io";
const DEFAULT_TITLE = "OpenTelemetry Ecosystem Explorer";
const DEFAULT_DESCRIPTION =
  "Search and explore the OpenTelemetry ecosystem: Collector components and Java agent " +
  "instrumentations, with telemetry, configuration, and version details.";

// Static asset extensions that must pass through untouched (never rewritten to
// the HTML shell). App routes have no such extension — note instrumentation
// slugs like "kafka-clients-0.11" end in a version, not a file extension.
const ASSET_EXT =
  /\.(js|mjs|css|map|json|xml|txt|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|wasm|pdf)$/i;

interface RouteMeta {
  title: string;
  description: string;
}

// Per-route SEO metadata generated at build time (dist/seo/routes.json), cached
// across invocations within an edge isolate.
let routesCache: Record<string, RouteMeta> | null = null;
let routesLoaded = false;

async function loadRoutes(context: Context): Promise<Record<string, RouteMeta>> {
  if (routesLoaded) {
    return routesCache ?? {};
  }
  try {
    const response = await context.rewrite("/seo/routes.json");
    if (response.status === 200) {
      routesCache = (await response.json()) as Record<string, RouteMeta>;
      // Only latch the cache on success; a transient failure (bad status,
      // network error, invalid JSON) leaves routesLoaded false so the next
      // request retries instead of degrading to defaults for the isolate's life.
      routesLoaded = true;
    }
  } catch {
    routesCache = null;
  }
  return routesCache ?? {};
}

// Fetches the pre-generated Markdown for a route (served at `${path}.md`).
// Returns null when the file doesn't exist — the SPA catch-all serves
// /index.html (200, text/html) for unknown paths, which we detect and treat as
// "no Markdown for this route".
async function fetchMarkdown(context: Context, mdPath: string): Promise<string | null> {
  try {
    const response = await context.rewrite(mdPath);
    if (response.status !== 200) return null;
    if ((response.headers.get("content-type") ?? "").includes("text/html")) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// Parameterized routes that are valid but not enumerated in routes.json (they
// resolve client-side): versioned Collector lists and the Java instrumentation
// version/redirect routes. Anything else not in the manifest is a real 404.
function isDynamicKnownRoute(pathname: string): boolean {
  if (/^\/collector\/components\/[^/]+$/.test(pathname)) return true;
  if (/^\/java-agent\/instrumentation\/(latest|\d[\w.+-]*)$/.test(pathname)) return true;
  if (/^\/java-agent\/instrumentation\/[^/]+\/[^/]+$/.test(pathname)) return true;
  if (pathname === "/_dev/components") return true;
  return false;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (value: string): string => escapeHtml(value).replace(/"/g, "&quot;");

// --- Minimal Markdown -> HTML for edge-side body injection -------------------
// Converts only the constrained Markdown shapes our build emits (headings,
// blockquotes, unordered lists, GFM tables, inline bold/code/links) — not a
// general Markdown implementation. The result is injected into `#root` so
// HTTP-only agents (which don't execute our React SPA) see real page content
// instead of an empty shell.

// Only http(s), root-relative (but not protocol-relative "//"), fragment, query,
// and relative links become anchors. Markdown can embed untrusted registry
// strings, so unsafe schemes (javascript:, data:, etc.) must not reach an
// `href` — even in the visually hidden agent body they'd be an XSS vector.
const isSafeHref = (href: string): boolean => {
  const h = href.trim();
  return /^https?:\/\//i.test(h) || /^(#|\?|\.\/|\.\.\/)/.test(h) || /^\/(?!\/)/.test(h);
};

// Inline formatting on a single line: code spans, bold, then links. The whole
// string is HTML-escaped first, so captured link hrefs only need quote-escaping.
function inlineMd(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, bold) => `<strong>${bold}</strong>`);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) =>
    isSafeHref(href) ? `<a href="${href.replace(/"/g, "&quot;")}">${label}</a>` : label
  );
  return s;
}

// Splits a table row on unescaped pipes, reversing the "\|" and "\\" escapes that
// escapeCell() introduces in the generator.
function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && i + 1 < body.length) {
      cur += body[i + 1];
      i++;
    } else if (ch === "|") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

const isTableSeparator = (line: string): boolean =>
  line.includes("-") && /^[\s|:-]+$/.test(line.trim());

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const isComment = (t: string): boolean => t.startsWith("<!--") && t.endsWith("-->");
  const isBlockStart = (t: string): boolean =>
    t === "" ||
    isComment(t) ||
    /^#{1,6}\s+/.test(t) ||
    /^>\s?/.test(t) ||
    /^[-*]\s+/.test(t) ||
    t.startsWith("|") ||
    /^-{3,}$/.test(t);

  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();

    // Blank lines and whole-line HTML comments.
    if (t === "" || isComment(t)) {
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(t);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMd(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^-{3,}$/.test(t)) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (/^>\s?/.test(t)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(inlineMd(lines[i].trim().replace(/^>\s?/, "")));
        i++;
      }
      out.push(`<blockquote><p>${buf.join("<br>")}</p></blockquote>`);
      continue;
    }

    if (t.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(lines[i]);
      i += 2; // consume the header row and the "| --- |" separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${header.map((c) => `<th>${inlineMd(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    if (/^[-*]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inlineMd(lines[i].trim().replace(/^[-*]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Paragraph. Always consume the current line first so `i` advances even when
    // it is a block-start line no handler claimed (e.g. a stray "|" that isn't a
    // table) — otherwise the loop would spin forever.
    const para: string[] = [inlineMd(t)];
    i++;
    while (i < lines.length && !isBlockStart(lines[i].trim())) {
      para.push(inlineMd(lines[i].trim()));
      i++;
    }
    out.push(`<p>${para.join(" ")}</p>`);
  }

  return out.join("\n");
}

// In-body directive pointing agents at the docs index and the page's Markdown.
// Kept in the page content area (a <p>, not <nav>/<script>/<style>) so it
// satisfies the afdocs llms-txt-directive-html check, which scans the <body> for
// a directive that survives HTML-to-Markdown conversion.
function llmsDirective(mdUrl: string): string {
  return (
    `<p>This documentation has an index for AI agents at ` +
    `<a href="/llms.txt">/llms.txt</a>. A Markdown version of this page is available at ` +
    `<a href="${escapeAttr(mdUrl)}">${escapeHtml(mdUrl)}</a>.</p>`
  );
}

// Wraps the agent-facing body injected into `#root`. It's rendered for HTTP-only
// agents that don't execute our React SPA; the app replaces it on mount
// (createRoot clears #root). The wrapper is:
//   - visually hidden (sr-only clip, NOT display:none which md converters may
//     strip) so human visitors never see a flash of unstyled content before
//     React mounts;
//   - aria-hidden so a screen reader doesn't announce it during the brief
//     pre-mount window, and inert so keyboard users can't tab into the hidden
//     links before React mounts (aria-hidden alone doesn't block focus).
// None of CSS, aria-hidden, or inert is honored by raw HTTP fetches or
// HTML-to-Markdown converters, so agents still receive the full text content.
const SR_ONLY_STYLE =
  "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;" +
  "clip:rect(0,0,0,0);white-space:nowrap;border:0";

function buildAgentBody(mdUrl: string, contentHtml: string): string {
  return (
    `<div inert aria-hidden="true" style="${SR_ONLY_STYLE}">` +
    llmsDirective(mdUrl) +
    `<main>${contentHtml}</main>` +
    `</div>`
  );
}

// Stub body for known routes without a generated Markdown page (e.g. versioned
// lists) and for 404s, so the injected body is never empty.
function fallbackContent(title: string, description: string): string {
  return (
    `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><ul>` +
    `<li><a href="/agent/collector/index.md">All Collector components</a></li>` +
    `<li><a href="/agent/javaagent/index.md">All Java agent instrumentations</a></li>` +
    `<li><a href="/llms.txt">Full documentation index</a></li></ul>`
  );
}

// Replaces the content="" value of a <meta> tag identified by `identifier`
// (e.g. `property="og:title"`). Our shell writes the identifier before content,
// so this targeted replacement is sufficient; unmatched tags are left as-is.
function setMetaContent(html: string, identifier: string, value: string): string {
  const re = new RegExp(`(<meta[^>]*${identifier}[^>]*content=")[^"]*(")`, "i");
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}

function buildJsonLd(title: string, description: string, canonicalUrl: string): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: canonicalUrl,
    isPartOf: { "@type": "WebSite", name: DEFAULT_TITLE, url: `${SITE_ORIGIN}/` },
  };
  // Escape "<" so the JSON can't terminate the <script> element early.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// Rewrites the SPA shell's <head> with per-route title/description/OG/canonical,
// a Markdown alternate link, and JSON-LD; injects `bodyHtml` into the empty
// `#root` so non-JS agents see real content (not a bare SPA shell); then returns
// it with `status` (200 for known routes, 404 for unknown ones so crawlers don't
// see soft 404s).
async function injectHead(
  shell: Response,
  opts: {
    title: string;
    description: string;
    canonicalUrl: string;
    mdUrl: string;
    status: number;
    bodyHtml: string;
  }
): Promise<Response> {
  const { title, description, canonicalUrl, mdUrl, status, bodyHtml } = opts;
  let html = await shell.text();

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMetaContent(html, 'name="description"', description);
  html = setMetaContent(html, 'property="og:title"', title);
  html = setMetaContent(html, 'property="og:description"', description);
  html = setMetaContent(html, 'property="og:url"', canonicalUrl);
  html = setMetaContent(html, 'name="twitter:title"', title);
  html = setMetaContent(html, 'name="twitter:description"', description);

  const extraHead =
    `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />` +
    `<link rel="alternate" type="text/markdown" href="${escapeAttr(mdUrl)}" />` +
    `<script type="application/ld+json">${buildJsonLd(title, description, canonicalUrl)}</script>`;
  html = html.replace(/<\/head>/i, `${extraHead}</head>`);

  // Populate the SPA root so HTTP-only agents see content. A function replacer
  // avoids `$`-sequence interpretation in bodyHtml (which can contain `$`).
  html = html.replace(/<div id="root">\s*<\/div>/, () => `<div id="root">${bodyHtml}</div>`);

  const headers = new Headers(shell.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "text/html; charset=utf-8");
  // Merge "Accept" into any existing Vary (the shell may already vary on e.g.
  // Accept-Encoding) rather than clobbering it, to keep caching correct.
  const vary = headers.get("vary");
  const varyParts = vary ? vary.split(",").map((p) => p.trim()) : [];
  if (!varyParts.some((p) => p.toLowerCase() === "accept")) {
    varyParts.push("Accept");
  }
  headers.set("vary", varyParts.join(", "));
  return new Response(html, { status, headers });
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const { pathname } = url;
  const acceptHeader = request.headers.get("accept") || "";
  const isMarkdownRequested = acceptHeader.includes("text/markdown");

  // Documentation root files
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") {
    return (
      (await serveAsset(context, pathname, "text/plain; charset=UTF-8", { Vary: "Accept" })) ??
      notFound()
    );
  }

  // Content negotiation for AI agents: prefer the page's own Markdown (generated
  // at the app-route path), falling back to the section index, then the docs root.
  if (isMarkdownRequested) {
    const candidates: string[] = [];
    if (pathname === "/" || pathname === "/index.html") {
      candidates.push("/index.md", "/llms.txt");
    } else {
      candidates.push(`${pathname}.md`);
      if (
        pathname === "/java-agent" ||
        pathname.startsWith("/java-agent/") ||
        pathname === "/javaagent" ||
        pathname.startsWith("/javaagent/")
      ) {
        candidates.push("/agent/javaagent/index.md");
      } else if (pathname === "/collector" || pathname.startsWith("/collector/")) {
        candidates.push("/agent/collector/index.md");
      }
    }

    for (const mdPath of candidates) {
      const finalContentType = mdPath.endsWith(".md")
        ? "text/markdown; charset=UTF-8"
        : "text/plain; charset=UTF-8";
      const response = await serveAsset(context, mdPath, finalContentType, { Vary: "Accept" });
      if (response) {
        return response;
      }
    }
    // Strict 404 for unrecognized Markdown requests (Copilot feedback)
    return notFound();
  }

  // Explicit agent documentation routes
  const agentPathMap: Record<string, string> = {
    "/agent/collector": "/agent/collector/index.md",
    "/agent/collector/": "/agent/collector/index.md",
    "/agent/collector/versions": "/agent/collector/versions.md",
    "/agent/collector/versions/": "/agent/collector/versions.md",
    "/agent/javaagent": "/agent/javaagent/index.md",
    "/agent/javaagent/": "/agent/javaagent/index.md",
    "/agent/javaagent/versions": "/agent/javaagent/versions.md",
    "/agent/javaagent/versions/": "/agent/javaagent/versions.md",
  };

  const resolvedPath = agentPathMap[pathname] || pathname;
  if (resolvedPath.endsWith(".md") || resolvedPath.startsWith("/agent/")) {
    if (resolvedPath.endsWith(".md")) {
      const response = await serveAsset(context, resolvedPath, "text/markdown; charset=UTF-8");
      if (response) {
        return response;
      }
    }
    return notFound();
  }

  // JSON schemas and metadata
  if (pathname.startsWith("/schemas/") || pathname.startsWith("/data/")) {
    const finalContentType = pathname.endsWith(".json") ? "application/json" : "text/plain";
    return (await serveAsset(context, pathname, finalContentType)) ?? notFound();
  }

  // Sitemap and Robots
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
    const finalContentType = pathname.endsWith(".xml") ? "application/xml" : "text/plain";
    return (await serveAsset(context, pathname, finalContentType)) ?? notFound();
  }

  // HTML page navigation. Inject per-route metadata so non-JS social scrapers
  // and crawlers get page-specific title/description/OG/canonical, and return a
  // real 404 for unknown routes. Asset requests and non-GET methods pass through
  // untouched so Netlify serves them (or the SPA shell) as before.
  if (request.method !== "GET" || ASSET_EXT.test(pathname)) {
    return undefined;
  }

  const shell = await context.rewrite("/index.html");
  const shellType = shell.headers.get("content-type") ?? "";
  if (shell.status !== 200 || !shellType.includes("text/html")) {
    // Not the shell we expected — leave the response untouched.
    return shell.status === 200 ? undefined : shell;
  }

  // Normalize /index.html and trailing slashes to the canonical route key so
  // those variants resolve against the manifest instead of falling to a 404.
  const lookupPath =
    pathname === "/index.html"
      ? "/"
      : pathname.length > 1 && pathname.endsWith("/")
        ? pathname.replace(/\/+$/, "")
        : pathname;

  const routes = await loadRoutes(context);
  const manifestLoaded = Object.keys(routes).length > 0;
  const meta = routes[lookupPath];
  // If the manifest failed to load, don't risk false 404s: treat every page as known.
  const known = !manifestLoaded || Boolean(meta) || isDynamicKnownRoute(lookupPath);

  const title = meta?.title ?? (known ? DEFAULT_TITLE : `Page not found — ${DEFAULT_TITLE}`);
  const description = meta?.description ?? DEFAULT_DESCRIPTION;
  const canonicalUrl = `${SITE_ORIGIN}${lookupPath}`;
  // The homepage's Markdown is /index.md (the route's own generated page), not
  // /llms.txt. Keep mdPath (fetched + injected), mdUrl (advertised alternate +
  // directive), and the Accept negotiation below all pointing at the same file.
  const mdPath = lookupPath === "/" ? "/index.md" : `${lookupPath}.md`;
  const mdUrl = `${SITE_ORIGIN}${mdPath}`;

  // Body injected into #root so HTTP-only agents get real content instead of an
  // empty shell. Prefer the route's pre-generated Markdown; fall back to a
  // title/description stub for known routes without a Markdown page and for 404s.
  let contentHtml: string;
  if (!known) {
    contentHtml = fallbackContent("Page not found", `The page ${lookupPath} could not be found.`);
  } else {
    const md = await fetchMarkdown(context, mdPath);
    contentHtml = md ? markdownToHtml(md) : fallbackContent(title, description);
  }

  return injectHead(shell, {
    title,
    description,
    canonicalUrl,
    mdUrl,
    status: known ? 200 : 404,
    bodyHtml: buildAgentBody(mdUrl, contentHtml),
  });
};
