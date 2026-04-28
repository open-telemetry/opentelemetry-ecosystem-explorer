// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

const DIST_DIR = path.resolve("dist");
const SCREENSHOTS_DIR = path.resolve("screenshots");
const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}`;

async function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      const resolvedPath = path.resolve(DIST_DIR, urlPath.replace(/^\/+/, ""));
      if (!resolvedPath.startsWith(DIST_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      let filePath = resolvedPath;
      if (urlPath === "/") filePath = path.join(DIST_DIR, "index.html");
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
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR);

  const server = await startServer();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });

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
      } catch {}
      route.continue();
    });

    // We must set the feature flag in local storage because Vite build freezes import.meta.env
    // Wait, import.meta.env is replaced at build time. Did the build include the feature flag?
    // Let's set it in local storage just in case if the app supports it, or it was baked in during `bun run build`.
    // In our .env.development it was true, but `bun run build` uses .env.production where it might be false.
    // If it's false, the page might not load! Let's just try to go to the page directly.

    console.log("Taking collector list screenshot...");
    await page.goto(`${BASE_URL}/collector/components`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "collector-list.png") });
    console.log("Collector list screenshot done");

    console.log("Taking collector detail screenshot...");
    await page.goto(`${BASE_URL}/collector/components/receiver/otlp`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "collector-detail.png") });
    console.log("Collector detail screenshot done");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

takeScreenshots();
