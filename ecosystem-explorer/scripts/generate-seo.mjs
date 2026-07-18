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

/**
 * Build step (runs after `vite build`, alongside generate-agent-docs) that emits:
 *   - dist/seo/routes.json — canonical pathname -> { title, description } for every
 *     static route and every latest-version detail page. Consumed by the edge
 *     function to inject per-page metadata for social scrapers / non-JS crawlers.
 *   - dist/sitemap.xml — the full crawlable URL set (~500 URLs), absolute against
 *     the production origin. Overwrites the copy Vite emits from public/.
 *
 * Metadata text comes from the shared, dependency-free helper in src/lib/seo so
 * the generator, the client <Seo> component, and the edge all agree per URL.
 * Bun resolves the .ts import directly.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { SITE_ORIGIN } from "../src/lib/seo/constants.ts";
import {
  STATIC_ROUTE_META,
  collectorDetailPath,
  instrumentationDetailPath,
  deriveCollectorMeta,
  deriveInstrumentationMeta,
} from "../src/lib/seo/derive.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const distDir = path.join(rootDir, "dist");

// Per-route sitemap hints. Anything not listed (i.e. detail pages) uses the
// detail defaults below.
const STATIC_SITEMAP_HINTS = {
  "/": { changefreq: "daily", priority: "1.0" },
  "/collector": { changefreq: "daily", priority: "0.9" },
  "/java-agent": { changefreq: "daily", priority: "0.9" },
  "/collector/components": { changefreq: "daily", priority: "0.8" },
  "/java-agent/instrumentation": { changefreq: "daily", priority: "0.8" },
  "/java-agent/configuration": { changefreq: "weekly", priority: "0.7" },
  "/java-agent/configuration/builder": { changefreq: "weekly", priority: "0.6" },
  "/java-agent/releases": { changefreq: "weekly", priority: "0.7" },
  "/about": { changefreq: "monthly", priority: "0.5" },
};
const DETAIL_SITEMAP_HINT = { changefreq: "weekly", priority: "0.6" };

const readJson = async (relPath) =>
  JSON.parse(await fs.readFile(path.join(publicDir, relPath), "utf-8"));

const latestVersion = (versionsIndex) => versionsIndex.versions.find((v) => v.is_latest)?.version;

/** Resolves the latest-version Collector components to canonical path -> meta. */
async function collectorRoutes() {
  const routes = {};
  const versionsIndex = await readJson("data/collector/versions-index.json");
  const version = latestVersion(versionsIndex);
  if (!version) {
    console.warn("[WARN] No latest Collector version found; skipping collector detail routes.");
    return routes;
  }

  const manifest = await readJson(`data/collector/versions/${version}-index.json`);
  const index = await readJson("data/collector/index.json");
  const byId = new Map(index.components.map((c) => [c.id, c]));

  for (const id of Object.keys(manifest.components || {})) {
    const component = byId.get(id);
    if (!component) {
      console.warn(`[WARN] Collector component in ${version} manifest missing from index: ${id}`);
      continue;
    }
    routes[collectorDetailPath(component)] = deriveCollectorMeta(component);
  }
  return routes;
}

/** Resolves the latest-version Java instrumentations to canonical path -> meta. */
async function javaAgentRoutes() {
  const routes = {};
  const versionsIndex = await readJson("data/javaagent/versions-index.json");
  const version = latestVersion(versionsIndex);
  if (!version) {
    console.warn("[WARN] No latest Java agent version found; skipping instrumentation routes.");
    return routes;
  }

  const manifest = await readJson(`data/javaagent/versions/${version}-index.json`);
  const index = await readJson("data/javaagent/index.json");
  const byName = new Map(index.components.map((c) => [c.name, c]));

  const names = [
    ...Object.keys(manifest.instrumentations || {}),
    ...Object.keys(manifest.custom_instrumentations || {}),
  ];
  for (const name of names) {
    const instrumentation = byName.get(name) ?? { name };
    routes[instrumentationDetailPath(instrumentation)] = deriveInstrumentationMeta(instrumentation);
  }
  return routes;
}

const xmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildSitemap(pathnames) {
  const urls = pathnames
    .map((pathname) => {
      const hint = STATIC_SITEMAP_HINTS[pathname] ?? DETAIL_SITEMAP_HINT;
      return [
        "  <url>",
        `    <loc>${xmlEscape(SITE_ORIGIN + pathname)}</loc>`,
        `    <changefreq>${hint.changefreq}</changefreq>`,
        `    <priority>${hint.priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function generateSeo() {
  console.log("Generating SEO manifest and sitemap...");

  const routes = {
    ...STATIC_ROUTE_META,
    ...(await collectorRoutes()),
    ...(await javaAgentRoutes()),
  };

  // routes.json — sorted keys for stable diffs.
  const sortedRoutes = Object.fromEntries(
    Object.keys(routes)
      .sort()
      .map((k) => [k, routes[k]])
  );
  await fs.mkdir(path.join(distDir, "seo"), { recursive: true });
  await fs.writeFile(
    path.join(distDir, "seo/routes.json"),
    `${JSON.stringify(sortedRoutes, null, 2)}\n`
  );
  console.log(` - Generated dist/seo/routes.json (${Object.keys(sortedRoutes).length} routes)`);

  // Sitemap: home first, then everything else sorted for stable diffs.
  const pathnames = Object.keys(routes).sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });
  await fs.writeFile(path.join(distDir, "sitemap.xml"), buildSitemap(pathnames));
  console.log(` - Generated dist/sitemap.xml (${pathnames.length} URLs)`);
}

generateSeo().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
