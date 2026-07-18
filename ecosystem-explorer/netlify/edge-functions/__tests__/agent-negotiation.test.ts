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
import { describe, it, expect, vi } from "vitest";
import handler from "../agent-negotiation";

type Rewrite = (path: string) => Promise<Response>;

function contextWith(rewrite: Rewrite) {
  return { rewrite: vi.fn(rewrite) } as unknown as Parameters<typeof handler>[1];
}

function get(path: string, headers?: Record<string, string>) {
  return new Request(`https://explorer.opentelemetry.io${path}`, { headers });
}

describe("agent-negotiation edge function", () => {
  it("passes a 304 Not Modified through for /data instead of converting it to 404", async () => {
    const context = contextWith(async () => new Response(null, { status: 304 }));
    const res = await handler(get("/data/configuration/versions-index.json"), context);
    expect(res?.status).toBe(304);
  });

  it("returns the JSON asset with application/json on a 200 rewrite", async () => {
    const context = contextWith(
      async () =>
        new Response('{"versions":[]}', {
          status: 200,
          headers: { "content-type": "text/plain" },
        })
    );
    const res = await handler(get("/data/configuration/versions-index.json"), context);
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toBe("application/json");
  });

  it("returns 404 when the rewrite falls back to the SPA HTML shell", async () => {
    const context = contextWith(
      async () =>
        new Response("<!doctype html><html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
    );
    const res = await handler(get("/data/configuration/versions-index.json"), context);
    expect(res?.status).toBe(404);
  });

  it("passes a 304 Not Modified through for a markdown agent route", async () => {
    const context = contextWith(async () => new Response(null, { status: 304 }));
    const res = await handler(get("/agent/javaagent"), context);
    expect(res?.status).toBe(304);
  });

  it("serves markdown for /javaagent with Accept: text/markdown", async () => {
    const context = contextWith(
      async () =>
        new Response("# Java Agent", {
          status: 200,
          headers: { "content-type": "text/plain" },
        })
    );
    const res = await handler(get("/javaagent", { accept: "text/markdown" }), context);
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toBe("text/markdown; charset=UTF-8");
  });

  it("returns 404 for unrelated paths starting with agent prefixes", async () => {
    const context = contextWith(
      async () =>
        new Response("<!doctype html><html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
    );
    const res1 = await handler(get("/javaagent-foo", { accept: "text/markdown" }), context);
    expect(res1?.status).toBe(404);

    const res2 = await handler(get("/java-agent-foo", { accept: "text/markdown" }), context);
    expect(res2?.status).toBe(404);
  });
});
