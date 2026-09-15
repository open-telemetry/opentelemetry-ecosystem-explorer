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

// A HEAD response must not carry a body, so the 404 explanation is omitted for
// that method. Content-Length is left off rather than set to the length the GET
// body would have — it is optional here, and a wrong value is worse than none.
const notFound = (request: Request) =>
  new Response(request.method === "HEAD" ? null : "Not Found", { status: 404 });

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
const MANIFEST_PATH = "/seo/routes.json";
let routesCache: Record<string, RouteMeta> | null = null;
let routesLoaded = false;

// The manifest is a build artifact — the same file for every request — so it is
// fetched with an explicit GET instead of context.rewrite(), which inherits the
// in-flight method. On a HEAD request the rewrite resolves with no body, json()
// throws, and the empty manifest would make every fabricated path look known
// (200 instead of 404). The rewrite is still used for GET: it stays inside the
// CDN instead of taking a network hop back to the origin.
async function loadRoutes(request: Request, context: Context): Promise<Record<string, RouteMeta>> {
  if (routesLoaded) {
    return routesCache ?? {};
  }
  try {
    const response =
      request.method === "GET"
        ? await context.rewrite(MANIFEST_PATH)
        : await fetch(new URL(MANIFEST_PATH, request.url), { method: "GET" });
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
// "no Markdown for this route". The text is empty (but non-null) when the
// rewrite inherits a HEAD request, so callers that only need existence must test
// for null rather than for truthiness.
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
// version list. Anything else not in the manifest is a real 404.
function isDynamicKnownRoute(pathname: string): boolean {
  if (/^\/collector\/components\/[^/]+$/.test(pathname)) return true;
  if (/^\/java-agent\/instrumentation\/(latest|\d[\w.+-]*)$/.test(pathname)) return true;
  if (pathname === "/_dev/components") return true;
  return false;
}

interface RouteStatus {
  meta?: RouteMeta;
  known: boolean;
}

// Resolves a path against the build-time manifest plus the dynamic route
// patterns. If the manifest failed to load, don't risk false 404s: treat every
// page as known.
async function routeStatus(
  request: Request,
  context: Context,
  lookupPath: string
): Promise<RouteStatus> {
  const routes = await loadRoutes(request, context);
  const manifestLoaded = Object.keys(routes).length > 0;
  const meta = routes[lookupPath];
  return { meta, known: !manifestLoaded || Boolean(meta) || isDynamicKnownRoute(lookupPath) };
}

// Normalizes /index.html and trailing slashes to the canonical route key so those
// variants resolve against the manifest instead of falling to a 404.
function normalizeLookupPath(pathname: string): string {
  if (pathname === "/index.html") return "/";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;
}

// `/javaagent` is not an app route — it is the spelling agents commonly guess for
// the Java agent section. Map it onto the real prefix so the known-route check
// resolves the alias instead of 404ing it.
const canonicalizeAlias = (pathname: string): string =>
  pathname === "/javaagent"
    ? "/java-agent"
    : pathname.startsWith("/javaagent/")
      ? `/java-agent${pathname.slice("/javaagent".length)}`
      : pathname;

// The generated section index for a path, or null when the path is outside both
// documented sections.
function sectionIndexFor(pathname: string): string | null {
  const p = canonicalizeAlias(pathname);
  if (p === "/java-agent" || p.startsWith("/java-agent/")) return "/agent/javaagent/index.md";
  if (p === "/collector" || p.startsWith("/collector/")) return "/agent/collector/index.md";
  return null;
}

// Deprecated Java route: `/java-agent/instrumentation/:version/:name` moved to
// `/java-agent/instrumentation/:name?version=:version`. The SPA performs that hop
// with a React <Navigate>, which HTTP-only clients never execute — they get a 200
// and a generic shell with no Location header. Issue the redirect at the edge so
// it is visible over plain HTTP.
const LEGACY_JAVA_VERSION_ROUTE = /^\/java-agent\/instrumentation\/(latest|\d[\w.+-]*)\/([^/]+)$/;

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
// `mdUrl` is null when the route has no generated Markdown page (versioned lists,
// 404s); the index sentence still renders so the afdocs check keeps passing.
function llmsDirective(mdUrl: string | null): string {
  const index = `This documentation has an index for AI agents at <a href="/llms.txt">/llms.txt</a>.`;
  const alternate = mdUrl
    ? ` A Markdown version of this page is available at ` +
      `<a href="${escapeAttr(mdUrl)}">${escapeHtml(mdUrl)}</a>.`
    : "";
  return `<p>${index}${alternate}</p>`;
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

function buildAgentBody(mdUrl: string | null, contentHtml: string): string {
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

interface InjectOptions {
  title: string;
  description: string;
  canonicalUrl: string;
  mdUrl: string | null;
  status: number;
  // null for HEAD requests, which must answer with headers only: the shell body
  // is neither read nor rewritten.
  bodyHtml: string | null;
}

// Rewrites the SPA shell's <head> with per-route title/description/OG/canonical,
// a Markdown alternate link, and JSON-LD, and injects `bodyHtml` into the empty
// `#root` so non-JS agents see real content (not a bare SPA shell).
function rewriteShell(shellHtml: string, opts: InjectOptions & { bodyHtml: string }): string {
  const { title, description, canonicalUrl, mdUrl, bodyHtml } = opts;
  let html = shellHtml;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMetaContent(html, 'name="description"', description);
  html = setMetaContent(html, 'property="og:title"', title);
  html = setMetaContent(html, 'property="og:description"', description);
  html = setMetaContent(html, 'property="og:url"', canonicalUrl);
  html = setMetaContent(html, 'name="twitter:title"', title);
  html = setMetaContent(html, 'name="twitter:description"', description);

  const extraHead =
    `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />` +
    (mdUrl ? `<link rel="alternate" type="text/markdown" href="${escapeAttr(mdUrl)}" />` : "") +
    `<script type="application/ld+json">${buildJsonLd(title, description, canonicalUrl)}</script>`;
  html = html.replace(/<\/head>/i, `${extraHead}</head>`);

  // Populate the SPA root so HTTP-only agents see content. A function replacer
  // avoids `$`-sequence interpretation in bodyHtml (which can contain `$`).
  return html.replace(/<div id="root">\s*<\/div>/, () => `<div id="root">${bodyHtml}</div>`);
}

// Returns the rewritten shell with `status` (200 for known routes, 404 for
// unknown ones so crawlers don't see soft 404s), or a bodyless response with the
// same headers when `bodyHtml` is null (HEAD). `mdUrl` is null when no Markdown
// page exists for the route, in which case no alternate is advertised in either
// the <head> or the Link header.
async function injectHead(shell: Response, opts: InjectOptions): Promise<Response> {
  const { mdUrl, status, bodyHtml } = opts;

  let html: string | null = null;
  if (bodyHtml === null) {
    // HEAD: a body would be protocol-incorrect, so drop the shell's instead of
    // leaving its stream dangling.
    await shell.body?.cancel();
  } else {
    html = rewriteShell(await shell.text(), { ...opts, bodyHtml });
  }

  const headers = new Headers(shell.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "text/html; charset=utf-8");
  // Announce the Markdown alternate as a response header as well as in <head>, so
  // an agent can discover it with a HEAD request instead of fetching and parsing
  // the HTML.
  if (mdUrl) {
    headers.set("link", `<${mdUrl}>; rel="alternate"; type="text/markdown"`);
  }
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
  const lookupPath = normalizeLookupPath(pathname);

  const legacyJavaRoute = LEGACY_JAVA_VERSION_ROUTE.exec(lookupPath);
  if (legacyJavaRoute) {
    const [, version, name] = legacyJavaRoute;
    const params = new URLSearchParams(url.search);
    params.set("version", version);
    return new Response(null, {
      status: 301,
      headers: { Location: `/java-agent/instrumentation/${name}?${params}` },
    });
  }

  // Documentation root files
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") {
    return (
      (await serveAsset(context, pathname, "text/plain; charset=UTF-8", { Vary: "Accept" })) ??
      notFound(request)
    );
  }

  // Content negotiation for AI agents: prefer the page's own Markdown (generated
  // at the app-route path), falling back to the section index, then the docs root.
  if (isMarkdownRequested) {
    const ownMd = lookupPath === "/" ? "/index.md" : `${lookupPath}.md`;
    const own = await serveAsset(context, ownMd, "text/markdown; charset=UTF-8", {
      Vary: "Accept",
    });
    if (own) {
      return own;
    }

    if (lookupPath === "/") {
      return (
        (await serveAsset(context, "/llms.txt", "text/plain; charset=UTF-8", { Vary: "Accept" })) ??
        notFound(request)
      );
    }

    // Section-index fallback, but only for paths that are real routes. Serving the
    // index for a fabricated path returned 200 with a 71 KB body, so an agent
    // could not tell "your URL is wrong" from "here is your answer" and had no
    // signal to retry with a corrected path.
    const sectionIndex = sectionIndexFor(lookupPath);
    if (
      sectionIndex &&
      (await routeStatus(request, context, canonicalizeAlias(lookupPath))).known
    ) {
      const response = await serveAsset(context, sectionIndex, "text/markdown; charset=UTF-8", {
        Vary: "Accept",
      });
      if (response) {
        return response;
      }
    }
    // Strict 404 for unrecognized Markdown requests (Copilot feedback)
    return notFound(request);
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
    return notFound(request);
  }

  // JSON schemas and metadata
  if (pathname.startsWith("/schemas/") || pathname.startsWith("/data/")) {
    const finalContentType = pathname.endsWith(".json") ? "application/json" : "text/plain";
    return (await serveAsset(context, pathname, finalContentType)) ?? notFound(request);
  }

  // Sitemap and Robots
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
    const finalContentType = pathname.endsWith(".xml") ? "application/xml" : "text/plain";
    return (await serveAsset(context, pathname, finalContentType)) ?? notFound(request);
  }

  // HTML page navigation. Inject per-route metadata so non-JS social scrapers
  // and crawlers get page-specific title/description/OG/canonical, and return a
  // real 404 for unknown routes. HEAD is handled alongside GET so the Link
  // alternate header below is discoverable without downloading the page; asset
  // requests and other methods pass through untouched so Netlify serves them (or
  // the SPA shell) as before.
  const isHead = request.method === "HEAD";
  if ((request.method !== "GET" && !isHead) || ASSET_EXT.test(pathname)) {
    return undefined;
  }

  const shell = await context.rewrite("/index.html");
  const shellType = shell.headers.get("content-type") ?? "";
  if (shell.status !== 200 || !shellType.includes("text/html")) {
    // Not the shell we expected — leave the response untouched.
    return shell.status === 200 ? undefined : shell;
  }

  const { meta, known } = await routeStatus(request, context, lookupPath);

  const title = meta?.title ?? (known ? DEFAULT_TITLE : `Page not found — ${DEFAULT_TITLE}`);
  const description = meta?.description ?? DEFAULT_DESCRIPTION;
  const canonicalUrl = `${SITE_ORIGIN}${lookupPath}`;
  // The homepage's Markdown is /index.md (the route's own generated page), not
  // /llms.txt. Keep mdPath (fetched + injected), mdUrl (advertised alternate +
  // directive), and the Accept negotiation above all pointing at the same file.
  const mdPath = lookupPath === "/" ? "/index.md" : `${lookupPath}.md`;

  // Body injected into #root so HTTP-only agents get real content instead of an
  // empty shell. Prefer the route's pre-generated Markdown; fall back to a
  // title/description stub for known routes without a Markdown page and for 404s.
  // The alternate is advertised only when that Markdown actually exists — a
  // dangling alternate is a 404 the agent has to spend a request to discover.
  // context.rewrite() carries the request method through, so on HEAD this probe
  // resolves with an empty body: existence is "the rewrite resolved" (non-null),
  // not "it returned text".
  const md = known ? await fetchMarkdown(context, mdPath) : null;
  const mdUrl = (isHead ? md !== null : Boolean(md)) ? `${SITE_ORIGIN}${mdPath}` : null;

  // HEAD gets headers only — same status and Link alternate as the GET, no body.
  let bodyHtml: string | null = null;
  if (!isHead) {
    const contentHtml = md
      ? markdownToHtml(md)
      : known
        ? fallbackContent(title, description)
        : fallbackContent("Page not found", `The page ${lookupPath} could not be found.`);
    bodyHtml = buildAgentBody(mdUrl, contentHtml);
  }

  return injectHead(shell, {
    title,
    description,
    canonicalUrl,
    mdUrl,
    status: known ? 200 : 404,
    bodyHtml,
  });
};
