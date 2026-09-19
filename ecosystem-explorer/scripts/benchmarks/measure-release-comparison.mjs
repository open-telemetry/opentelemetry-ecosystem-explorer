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

// Benchmarks Java Agent release-comparison performance: compares a server
// running `main` against a server running a PR branch, on the same
// comparison URL, across simulated network latencies.
//
// Usage:
//   bun scripts/benchmarks/measure-release-comparison.mjs [options]
//
// Options (all optional, shown with defaults):
//   --main-url=http://localhost:5180
//   --pr-url=http://localhost:5181
//   --from=2.28.1
//   --to=2.29.0
//   --runs=5                per branch, per latency
//   --latencies=0,40,80     comma-separated milliseconds
import { chromium } from "playwright";

function parseArgs(argv) {
  const opts = {
    mainUrl: "http://localhost:5180",
    prUrl: "http://localhost:5181",
    from: "2.28.1",
    to: "2.29.0",
    runs: 5,
    latencies: [0, 40, 80],
  };
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "main-url") opts.mainUrl = value;
    else if (key === "pr-url") opts.prUrl = value;
    else if (key === "from") opts.from = value;
    else if (key === "to") opts.to = value;
    else if (key === "runs") opts.runs = Number(value);
    else if (key === "latencies") opts.latencies = value.split(",").map(Number);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const urlPath = `/java-agent/releases?from=${opts.from}&to=${opts.to}`;

// A stuck browser.close() or CDP call can pin the event loop past a
// Promise.race timeout (there's no real cancellation in JS), so this is the
// actual backstop against the script hanging forever.
const totalMeasurements = 2 * opts.latencies.length * opts.runs;
const WATCHDOG_MS = totalMeasurements * 30000 + 30000;
setTimeout(() => {
  console.error(`watchdog fired after ${WATCHDOG_MS}ms - forcing exit`);
  process.exit(1);
}, WATCHDOG_MS);

function classify(url) {
  if (url.includes("/versions-index.json")) return "versions-index";
  if (/\/versions\/[^/]+-index\.json$/.test(url)) return "manifest";
  if (url.includes("/instrumentations/") && url.endsWith(".json")) return "detail";
  if (url.includes("/bundles/")) return "bundle";
  return "other";
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function measureOnce(baseUrl, latencyMs) {
  const browser = await chromium.launch();
  try {
    return await withTimeout(
      measureWithBrowser(browser, baseUrl, latencyMs),
      25000,
      "measureWithBrowser"
    );
  } finally {
    // Give up on a hung close() after 5s rather than block the retry loop;
    // the watchdog above is the real backstop against a leaked handle.
    await withTimeout(browser.close(), 5000, "browser.close").catch(() => {});
  }
}

async function measureWithBrowser(browser, baseUrl, latencyMs) {
  // Fresh, unpersisted context per run: no HTTP cache, no IndexedDB, so every
  // run issues the same network requests a reader's first visit would.
  const context = await browser.newContext();
  const page = await context.newPage();

  if (latencyMs > 0) {
    const client = await context.newCDPSession(page);
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: latencyMs,
      downloadThroughput: (20 * 1024 * 1024) / 8, // 20 Mbps, generous - isolate latency
      uploadThroughput: (10 * 1024 * 1024) / 8,
    });
  }

  const responses = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("/data/javaagent/")) return;
    let bytes = 0;
    try {
      bytes = (await res.body()).length;
    } catch {
      // response body unavailable (e.g. redirected/aborted) - count as 0
      // bytes, the request is still counted.
    }
    responses.push({ url, kind: classify(url), bytes });
  });

  const t0 = performance.now();
  await page.goto(`${baseUrl}${urlPath}`, { waitUntil: "domcontentloaded" });

  // #panel-changes only renders once the diff has finished loading (see
  // java-release-comparison-page.tsx), so waiting for it plus real content
  // (diff cards or the "no changes" state) is the first point the
  // comparison result is actually visible to the user.
  await page.waitForSelector('[role="tabpanel"]#panel-changes', { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const panel = document.querySelector("#panel-changes");
      if (!panel) return false;
      const hasCards = panel.querySelector('[class*="grid"] > *') !== null;
      const hasEmptyState = panel.textContent && panel.textContent.trim().length > 0;
      return hasCards || hasEmptyState;
    },
    { timeout: 30000 }
  );
  await page.waitForTimeout(100); // let any trailing microtask/render settle
  const comparisonReadyMs = Math.round(performance.now() - t0);

  const detailRequests = responses.filter((r) => r.kind === "detail").length;
  const detailBytes = responses.filter((r) => r.kind === "detail").reduce((s, r) => s + r.bytes, 0);

  return {
    comparisonReadyMs,
    totalRequests: responses.length,
    detailRequests,
    detailBytes,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function runCondition(label, baseUrl, latencyMs, runs) {
  const results = [];
  for (let i = 1; i <= runs; i++) {
    let result;
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        result = await measureOnce(baseUrl, latencyMs);
        break;
      } catch (err) {
        console.error(
          `[${label}@${latencyMs}ms] run ${i} attempt ${attempt} failed: ${err.message}`
        );
        if (attempt >= 3) throw err;
        await sleep(2000);
      }
    }
    results.push(result);
    console.error(
      `[${label}@${latencyMs}ms] run ${i}/${runs}: comparisonReady=${result.comparisonReadyMs}ms ` +
        `detailRequests=${result.detailRequests} totalRequests=${result.totalRequests} detailBytes=${result.detailBytes}`
    );
    await sleep(500);
  }
  return results;
}

const allResults = { main: {}, pr: {} };

for (const latencyMs of opts.latencies) {
  allResults.main[latencyMs] = await runCondition("main", opts.mainUrl, latencyMs, opts.runs);
  allResults.pr[latencyMs] = await runCondition("pr", opts.prUrl, latencyMs, opts.runs);
}

function summarize(branchResults) {
  return {
    medianMs: median(branchResults.map((r) => r.comparisonReadyMs)),
    detailRequests: branchResults[0].detailRequests,
    totalRequests: branchResults[0].totalRequests,
    detailBytes: branchResults[0].detailBytes,
  };
}

// Positive improvementPct means the PR is faster; negative means slower.
const rows = opts.latencies.map((latencyMs) => {
  const main = summarize(allResults.main[latencyMs]);
  const pr = summarize(allResults.pr[latencyMs]);
  const improvementPct = ((main.medianMs - pr.medianMs) / main.medianMs) * 100;
  return { latencyMs, main, pr, improvementPct };
});

console.log("=== SUMMARY ===");
console.log(`URL: ${urlPath}`);
console.log(`Main: ${opts.mainUrl}   PR: ${opts.prUrl}`);
console.log(`Runs per branch per latency: ${opts.runs}\n`);

const header = [
  "Latency",
  "Main median",
  "PR median",
  "Improvement",
  "Main detail reqs",
  "PR detail reqs",
  "Main total reqs",
  "PR total reqs",
  "Main detail bytes",
  "PR detail bytes",
];
const tableRows = rows.map((r) => [
  `${r.latencyMs}ms`,
  `${r.main.medianMs}ms`,
  `${r.pr.medianMs}ms`,
  `${Math.abs(r.improvementPct).toFixed(1)}% ${r.improvementPct >= 0 ? "faster" : "slower"}`,
  String(r.main.detailRequests),
  String(r.pr.detailRequests),
  String(r.main.totalRequests),
  String(r.pr.totalRequests),
  String(r.main.detailBytes),
  String(r.pr.detailBytes),
]);
const widths = header.map((h, i) => Math.max(h.length, ...tableRows.map((row) => row[i].length)));
const formatRow = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join(" | ");
console.log(formatRow(header));
console.log(widths.map((w) => "-".repeat(w)).join("-|-"));
for (const row of tableRows) {
  console.log(formatRow(row));
}

console.log(
  "\nNote: request/byte counts are expected to be identical across runs at a given " +
    "latency (they are driven by content-addressed static files, not timing), so a " +
    "single value is shown per branch/latency rather than a range."
);

// Raw per-run results, for auditing the medians above.
console.log("\n=== RAW RESULTS (every run) ===");
console.log(JSON.stringify(allResults, null, 2));

process.exit(0);
