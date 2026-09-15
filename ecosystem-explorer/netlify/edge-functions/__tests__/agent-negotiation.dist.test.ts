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
// Runs the edge handler against the real `dist/` produced by `bun run build`,
// with context.rewrite() backed by an HTTP server that mirrors netlify.toml
// (existing file wins; everything else falls through to /index.html with 200).
// The mocked-context suite proves the branching; this proves the paths the
// branches build (`${route}.md`, /seo/routes.json, /agent/**) match what the
// build actually emits. Skipped when dist/ is absent, since dist is gitignored
// and CI builds after the unit tests run.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import handler from "../agent-negotiation";

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist");
const hasDist = existsSync(join(distDir, "index.html"));

// Locally the suite skips when nothing has been built yet; in CI it must not
// pass vacuously, because the step that runs it comes right after the build.
if (!hasDist && process.env.CI) {
  throw new Error("dist/ is missing — run `bun run build` before `bun run test:edge`");
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

describe.skipIf(!hasDist)("agent-negotiation against the built dist/", () => {
  let server: Server;
  let base: string;

  // URL path -> absolute file, indexed once from dist/. The request path is only
  // ever a lookup key here: nothing derived from it reaches the filesystem, so a
  // "../" in a URL misses the map and falls through to the catch-all like any
  // other unknown path.
  const filesByUrlPath = new Map<string, string>();

  beforeAll(async () => {
    for (const entry of readdirSync(distDir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const absolute = join(entry.parentPath, entry.name);
      filesByUrlPath.set(`/${relative(distDir, absolute).split(sep).join("/")}`, absolute);
    }
    const indexHtml = join(distDir, "index.html");

    server = createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      // SPA catch-all: unknown paths get index.html with status 200, exactly the
      // shape the handler has to distinguish a real file from.
      const file = filesByUrlPath.get(urlPath) ?? indexHtml;
      res.writeHead(200, {
        "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
      });
      // node:http drops the body for HEAD on its own, mirroring the origin.
      res.end(readFileSync(file));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  // Netlify binds rewrite() to the in-flight request, so the method carries
  // through. The response is re-wrapped because fetch() hands back immutable
  // headers, while Netlify documents the rewrite/next response as mutable.
  const contextFor = (request: Request) =>
    ({
      rewrite: async (path: string) => {
        const upstream = await fetch(`${base}${path}`, { method: request.method });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: new Headers(upstream.headers),
        });
      },
    }) as unknown as Parameters<typeof handler>[1];

  // Requests carry the test server's own origin so the handler's explicit GET for
  // /seo/routes.json (rewrite() would inherit HEAD and come back bodyless) resolves
  // against dist/. Canonical URLs and the Link alternate stay pinned to the
  // production origin regardless, which the assertions below rely on.
  const run = (path: string, init?: RequestInit) => {
    const request = new Request(`${base}${path}`, init);
    return handler(request, contextFor(request));
  };

  // The route manifest is cached in module scope; a fresh instance reproduces the
  // first request an edge isolate sees.
  const runCold = async (path: string, init?: RequestInit) => {
    vi.resetModules();
    const { default: coldHandler } = await import("../agent-negotiation");
    const request = new Request(`${base}${path}`, init);
    return coldHandler(request, contextFor(request));
  };

  it("injects the route's real Markdown and advertises the alternate on GET", async () => {
    const res = await run("/collector");
    expect(res?.status).toBe(200);
    expect(res?.headers.get("link")).toBe(
      '<https://explorer.opentelemetry.io/collector.md>; rel="alternate"; type="text/markdown"'
    );
    const html = await res!.text();
    expect(html).not.toContain('<div id="root"></div>');
    expect(html).toContain(
      '<link rel="canonical" href="https://explorer.opentelemetry.io/collector" />'
    );
  });

  it("answers HEAD for the same route with headers only", async () => {
    const res = await run("/collector", { method: "HEAD" });
    expect(res?.status).toBe(200);
    expect(res?.body).toBeNull();
    expect(res?.headers.get("link")).toContain('rel="alternate"');
  });

  it("serves the built Markdown for Accept: text/markdown", async () => {
    const res = await run("/collector", { headers: { accept: "text/markdown" } });
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toBe("text/markdown; charset=UTF-8");
    expect(await res!.text()).toBe(readFileSync(join(distDir, "collector.md"), "utf-8"));
  });

  it("404s a fabricated route that the SPA catch-all would answer 200 for", async () => {
    const res = await run("/collector/components/contrib/nope-xyz-does-not-exist");
    expect(res?.status).toBe(404);
    expect(res?.headers.get("link")).toBeNull();
  });

  it("404s a fabricated route on a cold HEAD, when nothing has parsed the manifest yet", async () => {
    const res = await runCold("/nope-xyz-does-not-exist", { method: "HEAD" });
    expect(res?.status).toBe(404);
    expect(res?.body).toBeNull();
  });

  it("404s a fabricated section path on a cold HEAD asking for Markdown", async () => {
    const res = await runCold("/collector/nope-xyz-does-not-exist", {
      method: "HEAD",
      headers: { accept: "text/markdown" },
    });
    expect(res?.status).toBe(404);
  });

  it("serves the generated /llms.txt", async () => {
    const res = await run("/llms.txt");
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
  });

  it("emits a Markdown page for every route in the SEO manifest", async () => {
    const routes = JSON.parse(readFileSync(join(distDir, "seo/routes.json"), "utf-8"));
    const missing = Object.keys(routes).filter(
      (route) => !existsSync(join(distDir, route === "/" ? "index.md" : `${route}.md`))
    );
    expect(missing).toEqual([]);
    // Guard the agentPathMap targets too.
    for (const p of [
      "agent/collector/index.md",
      "agent/collector/versions.md",
      "agent/javaagent/index.md",
      "agent/javaagent/versions.md",
      "llms-full.txt",
    ]) {
      expect(existsSync(join(distDir, p)), p).toBe(true);
    }
  });
});
