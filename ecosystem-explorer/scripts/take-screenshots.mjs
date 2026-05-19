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

const DIST_DIR = path.resolve("dist");
const SCREENSHOTS_DIR = path.resolve("screenshots");
const A11Y_DIR = path.resolve("a11y");
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

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

const DETAIL_VERSION = resolveLatestVersion(
  path.resolve("public/data/javaagent/versions-index.json")
);
const DETAIL_NAME = "spring-webmvc-6.0";
const COLLECTOR_DISTRIBUTION = "core";
const COLLECTOR_DETAIL_NAME = "otlpreceiver";

// Viewport sizes captured for each page. Edit here to add, remove, or resize.
const VIEWPORTS = [
  { name: "desktop", width: 1800, height: 1200 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

// Themes captured for each page/viewport. Dark first because it's the default.
const THEMES = ["dark", "light"];

async function startServer() {
  return new Promise((resolve) => {
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

    server.listen(PORT, () => {
      console.log(`Server listening on ${BASE_URL}`);
      resolve(server);
    });
  });
}

async function settle(page, timeout = 10000) {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
}

async function clickTab(page, name) {
  try {
    const tab = page.getByRole("tab", { name });
    await tab.waitFor({ state: "visible", timeout: 5000 });
    await tab.click();
    await page.waitForSelector('[role="tabpanel"][data-state="active"]', {
      state: "visible",
      timeout: 5000,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return true;
  } catch {
    return false;
  }
}

async function assertNoError(page, url) {
  const errorHeading = page.getByRole("heading", { name: /error/i });
  const notFound = page.getByRole("heading", { name: /not found/i });
  const hasError = await errorHeading.isVisible().catch(() => false);
  const has404 = await notFound.isVisible().catch(() => false);
  if (hasError || has404) {
    throw new Error(`Screenshot aborted: error page detected at ${url}`);
  }
}

async function takeScreenshots() {
  const server = await startServer();
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

          // 1. Home page
          await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
          await page.waitForSelector("h1", { state: "visible", timeout: 5000 });
          await assertNoError(page, BASE_URL);
          await page.screenshot({ path: p("home") });
          if (isFirstViewport) await recordA11y(page, "home", theme);

          // 2. Java agent instrumentation list
          await page.goto(`${BASE_URL}/java-agent/instrumentation`, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });
          await settle(page);
          await assertNoError(page, `${BASE_URL}/java-agent/instrumentation`);
          await page.screenshot({ path: p("instrumentation-list") });
          if (isFirstViewport) await recordA11y(page, "instrumentation-list", theme);

          // 3. Java agent instrumentation detail - Details tab
          const detailUrl = `${BASE_URL}/java-agent/instrumentation/${DETAIL_VERSION}/${DETAIL_NAME}`;
          await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
          await settle(page);
          await assertNoError(page, detailUrl);
          await page.screenshot({ path: p("detail-details"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "detail-details", theme);

          // 4. Telemetry tab (skipped gracefully if tabs aren't present in this branch)
          await clickTab(page, "Telemetry");
          await assertNoError(page, detailUrl);
          await page.screenshot({ path: p("detail-telemetry"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "detail-telemetry", theme);

          // 5. Configuration tab (skipped gracefully if tabs aren't present in this branch)
          await clickTab(page, "Configuration");
          await assertNoError(page, detailUrl);
          await page.screenshot({ path: p("detail-configuration"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "detail-configuration", theme);

          // 6. Collector list
          await page.goto(`${BASE_URL}/collector/components`, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });
          await settle(page);
          await assertNoError(page, `${BASE_URL}/collector/components`);
          await page.screenshot({ path: p("collector-list") });
          if (isFirstViewport) await recordA11y(page, "collector-list", theme);

          // 7. Collector detail
          const collectorDetailUrl = `${BASE_URL}/collector/components/${COLLECTOR_DISTRIBUTION}/${COLLECTOR_DETAIL_NAME}`;
          await page.goto(collectorDetailUrl, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });
          await settle(page);
          await assertNoError(page, collectorDetailUrl);
          await page.screenshot({ path: p("collector-detail"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "collector-detail", theme);

          // 8. Dev component showcase — single page mounting every v1 primitive
          //    in its canonical states. Captured so a11y + pixel-diff can baseline
          //    the design-system surface independently of feature pages.
          const devUrl = `${BASE_URL}/_dev/components`;
          await page.goto(devUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
          await settle(page);
          await assertNoError(page, devUrl);
          await page.screenshot({ path: p("dev-components"), fullPage: true });
          if (isFirstViewport) await recordA11y(page, "dev-components", theme);

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
    await new Promise((resolve) => server.close(resolve));
  }
}

takeScreenshots();
