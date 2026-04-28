// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

const DIST_DIR = path.resolve("dist");
const SCREENSHOTS_DIR = path.resolve("screenshots");
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

// Pick an instrumentation known to have telemetry and configuration data
const DETAIL_VERSION = "2.25.0";
const DETAIL_NAME = "spring-webmvc-6.0";

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

async function takeScreenshots() {
  const server = await startServer();
  let browser;

  try {
    const startTime = Date.now();
    const logTime = (label) =>
      console.log(`[${((Date.now() - startTime) / 1000).toFixed(1)}s] ${label}`);

    logTime("Launching browser...");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1800, height: 1200 });

    // Block external requests that can cause timeouts
    const BLOCKED_HOSTS = new Set([
      "googletagmanager.com",
      "google-analytics.com",
      "fonts.googleapis.com",
      "fonts.gstatic.com",
    ]);
    await page.route("**/*", (route) => {
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
    });

    logTime("Browser ready");

    // 1. Home page
    logTime("Taking home page screenshot...");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForSelector("h1", { state: "visible", timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "home.png") });
    logTime("Home page screenshot done");

    // 2. Java agent instrumentation list
    logTime("Taking instrumentation list screenshot...");
    await page.goto(`${BASE_URL}/java-agent/instrumentation`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
    await page.waitForFunction(() => document.body.textContent.includes("Showing"), {
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "instrumentation-list.png"),
    });
    logTime("Instrumentation list screenshot done");

    // 3. Java agent instrumentation detail - Details tab
    logTime("Taking instrumentation detail screenshots...");
    const detailUrl = `${BASE_URL}/java-agent/instrumentation/${DETAIL_VERSION}/${DETAIL_NAME}`;
    await page.goto(detailUrl, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
    await page.waitForSelector('[role="tablist"]', {
      state: "visible",
      timeout: 10000,
    });
    // Details tab is active by default
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "detail-details.png"),
      fullPage: true,
    });
    logTime("Details tab screenshot done");

    // 4. Telemetry tab
    await page.getByRole("tab", { name: "Telemetry" }).click();
    await page.waitForSelector('[role="tabpanel"][data-state="active"]', {
      state: "visible",
      timeout: 5000,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "detail-telemetry.png"),
      fullPage: true,
    });
    logTime("Telemetry tab screenshot done");

    // 5. Configuration tab
    await page.getByRole("tab", { name: "Configuration" }).click();
    await page.waitForSelector('[role="tabpanel"][data-state="active"]', {
      state: "visible",
      timeout: 5000,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "detail-configuration.png"),
      fullPage: true,
    });
    logTime("Configuration tab screenshot done");

    logTime("All screenshots completed successfully!");
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
