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

import fs from "fs";
import http from "http";
import path from "path";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
import {
  acceptanceConfig,
  optionalScenario,
  waitForReady,
  clickTab,
  openCollectorFilters,
} from "./acceptance.mjs";

const config = acceptanceConfig("v1");
console.log(`Screenshot app mode: ${config.appMode} (set ACCEPTANCE_APP_MODE to override)`);

const DIST_DIR = path.resolve("dist");
const SCREENSHOTS_DIR = path.resolve("screenshots");
const A11Y_DIR = path.resolve("a11y");
const PORT = 4173;
// An existing dev/preview server can be used for focused local checks. Its
// rendered mode is still verified; the env var cannot toggle a built app.
const BASE_URL = process.env.ACCEPTANCE_BASE_URL || `http://localhost:${PORT}`;

// Track total a11y violations across the run for a summary at the end.
const a11ySummary = { runs: 0, violations: 0 };

/*
 * Run axe-core against the current page state and write the report to
 * `a11y/{name}-{theme}.json`. Runs once per (page × theme); viewports don't
 * change accessibility semantics, so re-running per viewport would just
 * duplicate the report.
 */
async function recordA11y(page, name, theme) {
  if (!fs.existsSync(A11Y_DIR)) fs.mkdirSync(A11Y_DIR, { recursive: true });
  const results = await new AxeBuilder({ page }).analyze();
  const report = {
    name,
    theme,
    url: page.url(),
    timestamp: new Date().toISOString(),
    violations: results.violations,
    incomplete: results.incomplete,
    passes: results.passes.length,
  };
  fs.writeFileSync(path.join(A11Y_DIR, `${name}-${theme}.json`), JSON.stringify(report, null, 2));
  a11ySummary.runs += 1;
  a11ySummary.violations += results.violations.length;
  if (results.violations.length > 0) {
    console.log(`    a11y: ${results.violations.length} violation(s) on ${name} / ${theme}`);
  }
}

// Resolve latest versions at runtime from the generated data files.
// This prevents the script from going stale when new versions are released.
function resolveLatestVersion(indexPath) {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const latest = index.versions.find((v) => v.is_latest);
  if (!latest) throw new Error(`No latest version found in ${indexPath}`);
  return latest.version;
}

// Resolve the two most recent Collector versions for the diff route. `to` is
// the latest release; `from` is the next-newest so the comparison spans a real
// version gap. Falls back to the single available version if only one exists.
function resolveCollectorDiffPair(indexPath) {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const versions = index.versions.map((v) => v.version);
  const to = index.versions.find((v) => v.is_latest)?.version ?? versions[0];
  const from = versions.find((v) => v !== to) ?? to;
  return { from, to };
}

const DETAIL_VERSION = resolveLatestVersion(
  path.resolve("public/data/javaagent/versions-index.json")
);
const DETAIL_NAME = "spring-webmvc-6.0";
const COLLECTOR_DISTRIBUTION = "core";
const COLLECTOR_DETAIL_NAME = "otlpreceiver";
const COLLECTOR_DIFF = resolveCollectorDiffPair(
  path.resolve("public/data/collector/versions-index.json")
);

// Collector list densities (Phase 4). The bare URL renders the default
// density (compact); the others are URL-driven via `?density=`.
const COLLECTOR_LIST_CAPTURES = [
  { name: "collector-list", query: "", ready: ".td-list--compact a" },
  { name: "collector-list-cards", query: "?density=cards", ready: ".td-list--cards a" },
  { name: "collector-list-table", query: "?density=table", ready: ".td-table tbody a" },
];

// Viewport sizes captured for each page. Edit here to add, remove, or resize.
const VIEWPORTS = [
  { name: "desktop", width: 1800, height: 1200 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

// Themes captured for each page/viewport. Dark first because it's the default.
const THEMES = ["dark", "light"];

async function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);

      // Resolve the requested path and ensure it stays within DIST_DIR
      const resolvedPath = path.resolve(DIST_DIR, urlPath.replace(/^\/+/, ""));
      if (!resolvedPath.startsWith(DIST_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      let filePath = resolvedPath;

      // Serve index.html for the root path
      if (urlPath === "/") {
        filePath = path.join(DIST_DIR, "index.html");
      }

      // If the file doesn't exist on disk, fall back to index.html for SPA routing
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, "index.html");
      }

      const ext = path.extname(filePath);
      const contentTypes = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
      };

      res.writeHead(200, {
        "Content-Type": contentTypes[ext] || "application/octet-stream",
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.once("error", reject);
    server.listen(PORT, () => {
      console.log(`Server listening on ${BASE_URL}`);
      resolve(server);
    });
  });
}

async function visit(page, scenario, url, selector = "main h1") {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
  await waitForReady(page, { appMode: config.appMode, scenario, selector });
}

function includeOptional(name) {
  const reason = optionalScenario(config, name);
  if (reason) console.log(`Skipping ${name}: ${reason}`);
  return !reason;
}

async function takeScreenshots() {
  const server = process.env.ACCEPTANCE_BASE_URL ? null : await startServer();
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  let browser;

  try {
    const startTime = Date.now();
    const logTime = (label) =>
      console.log(`[${((Date.now() - startTime) / 1000).toFixed(1)}s] ${label}`);

    logTime("Launching browser...");
    browser = await chromium.launch({ headless: true });

    // Block external requests that can cause timeouts
    const BLOCKED_HOSTS = new Set([
      "googletagmanager.com",
      "google-analytics.com",
      "fonts.googleapis.com",
      "fonts.gstatic.com",
    ]);
    const blockExternal = (route) => {
      try {
        const hostname = new URL(route.request().url()).hostname;
        if (
          BLOCKED_HOSTS.has(hostname) ||
          [...BLOCKED_HOSTS].some((h) => hostname.endsWith(`.${h}`))
        ) {
          route.abort();
          return;
        }
      } catch {
        // If URL parsing fails, allow the request
      }
      route.continue();
    };

    logTime("Browser ready");

    for (const theme of THEMES) {
      logTime(`Starting theme: ${theme}`);
      const context = await browser.newContext({ colorScheme: theme });
      const page = await context.newPage();
      await page.route("**/*", blockExternal);

      try {
        for (const viewport of VIEWPORTS) {
          logTime(`  ${theme} / ${viewport.name} (${viewport.width}×${viewport.height})...`);
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          const p = (name) => path.join(SCREENSHOTS_DIR, `${viewport.name}-${theme}-${name}.png`);
          // axe-core runs once per (page × theme) — viewports don't change a11y semantics.
          const isFirstViewport = viewport === VIEWPORTS[0];

          // Shared routes use the chrome selected by the explicit app mode.
          await visit(page, "home", BASE_URL);
          await page.screenshot({ path: p("home"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "home", theme);

          await visit(page, "collector-landing", `${BASE_URL}/collector`);
          await page.screenshot({ path: p("collector-landing"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "collector-landing", theme);

          await visit(page, "java-agent-landing", `${BASE_URL}/java-agent`);
          await page.screenshot({ path: p("java-agent-landing"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "java-agent-landing", theme);

          await visit(
            page,
            "instrumentation-list",
            `${BASE_URL}/java-agent/instrumentation`,
            'main a[href^="/java-agent/instrumentation/"]'
          );
          await page.screenshot({ path: p("instrumentation-list"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "instrumentation-list", theme);

          // Java detail tabs are required in both apps, which share this page.
          const detailUrl = `${BASE_URL}/java-agent/instrumentation/${DETAIL_VERSION}/${DETAIL_NAME}`;
          await visit(page, "detail-details", detailUrl, 'main [role="tabpanel"]');
          await clickTab(page, "Details", "detail-details");
          await page.screenshot({ path: p("detail-details"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "detail-details", theme);

          await clickTab(page, "Telemetry", "detail-telemetry");
          await page.screenshot({ path: p("detail-telemetry"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "detail-telemetry", theme);

          await clickTab(page, "Configuration", "detail-configuration");
          await page.screenshot({ path: p("detail-configuration"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "detail-configuration", theme);

          for (const { name, query, ready } of COLLECTOR_LIST_CAPTURES) {
            if (name !== "collector-list" && !includeOptional(name)) continue;
            await visit(
              page,
              name,
              `${BASE_URL}/collector/components${query}`,
              config.appMode === "v1" ? ready : 'main a[href^="/collector/components/"]'
            );
            await page.screenshot({ path: p(name), fullPage: true });
            if (isFirstViewport) await recordA11y(page, name, theme);
          }

          // The drawer only exists in the v1 mobile layout. A missing v1
          // control/dialog fails instead of producing a closed-drawer capture.
          if (viewport.name === "mobile" && includeOptional("collector-list-drawer")) {
            await visit(
              page,
              "collector-list-drawer",
              `${BASE_URL}/collector/components`,
              ".td-list--compact a"
            );
            await openCollectorFilters(page);
            await page.screenshot({ path: p("collector-list-drawer") });
            await recordA11y(page, "collector-list-drawer", theme);
          }

          const collectorDetailUrl = `${BASE_URL}/collector/components/${COLLECTOR_DISTRIBUTION}/${COLLECTOR_DETAIL_NAME}`;
          await visit(
            page,
            "collector-detail",
            collectorDetailUrl,
            config.appMode === "v1" ? 'main [role="tabpanel"]' : "main h1"
          );
          await page.screenshot({ path: p("collector-detail"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "collector-detail", theme);

          // The diff page is shared by both route tables.
          const collectorDiffUrl =
            `${BASE_URL}/collector/components/${COLLECTOR_DISTRIBUTION}/${COLLECTOR_DETAIL_NAME}/diff` +
            `?from=${COLLECTOR_DIFF.from}&to=${COLLECTOR_DIFF.to}`;
          await visit(page, "collector-diff", collectorDiffUrl, ".td-diff__sections");
          await page.screenshot({ path: p("collector-diff"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "collector-diff", theme);

          // Both route tables expose this optional build-time capability.
          // Disable explicitly with ACCEPTANCE_DEV_SHOWCASE=false when omitted
          // from the build; an enabled but missing showcase must fail.
          if (includeOptional("dev-components")) {
            await visit(page, "dev-components", `${BASE_URL}/_dev/components`);
            await page.screenshot({ path: p("dev-components"), fullPage: true });
            if (isFirstViewport) await recordA11y(page, "dev-components", theme);
          }

          logTime(`  ${theme} / ${viewport.name} done`);
        }
      } finally {
        await context.close();
      }
    }

    logTime("All screenshots completed successfully!");
    console.log(
      `a11y: ${a11ySummary.runs} page-theme combinations scanned, ` +
        `${a11ySummary.violations} total violation(s) across the run. ` +
        `Reports in ${path.relative(process.cwd(), A11Y_DIR)}/.`
    );
  } catch (error) {
    console.error("Error during screenshot process:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

takeScreenshots();
