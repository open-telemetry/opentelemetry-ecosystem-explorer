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
import { chromium } from "playwright";

const DIST_DIR = path.resolve("dist");
const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Starts a minimal local HTTP server to serve the static frontend assets from the DIST_DIR.
 * This is necessary because Playwright needs to navigate to a fully served application
 * to load all JS/CSS resources properly.
 *
 * @returns {Promise<http.Server>} A promise that resolves to the running HTTP server instance.
 */
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
      if (urlPath === "/") {
        filePath = path.join(DIST_DIR, "index.html");
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, "index.html");
      }

      const ext = path.extname(filePath);
      const contentTypes = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
      };

      res.writeHead(200, {
        "Content-Type": contentTypes[ext] || "application/octet-stream",
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, () => {
      resolve(server);
    });
  });
}

/**
 * Orchestrates the browser automation using Playwright.
 * Launches a headless browser, navigates to the configuration builder page,
 * selects an OTLP exporter, and extracts the generated YAML configuration.
 * The YAML is then saved to the specified output file for use in acceptance tests.
 */
async function generateConfig() {
  const server = await startServer();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.route("**/*", (route) => {
      const hostname = new URL(route.request().url()).hostname;
      if (["googletagmanager.com", "google-analytics.com"].includes(hostname)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(`${BASE_URL}/java-agent/configuration/builder`, {
      waitUntil: "networkidle",
      timeout: 20000,
    });

    try {
      await page
        .getByRole("button", { name: /Expand Exporter/i })
        .first()
        .click({ timeout: 5000 });
      await page.getByText("otlp_http").first().click({ timeout: 5000 });
    } catch (e) {
      console.log(
        "Could not toggle OTLP exporter, proceeding with default",
        e?.message || String(e)
      );
    }

    const yamlElement = page.locator("pre").first();
    await yamlElement.waitFor({ state: "visible", timeout: 10000 });
    let yamlContent = await yamlElement.textContent();

    if (!yamlContent) {
      throw new Error("YAML content could not be extracted from the configuration builder.");
    }

    if (yamlContent.includes("OpenTelemetry SDK Configuration")) {
      const codeElement = yamlElement.locator("code").first();
      if ((await codeElement.count()) > 0) {
        yamlContent = await codeElement.textContent();
      }
    }

    const outputPath = process.argv[2]
      ? path.resolve(process.argv[2])
      : path.resolve(process.cwd(), "test-config.yaml");
    fs.writeFileSync(outputPath, yamlContent.trim());
  } catch (error) {
    console.error("Error generating config:", error);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    server.close();
  }
}

generateConfig();
