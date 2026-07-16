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
type Handler = typeof handler;

function contextWith(rewrite: Rewrite) {
  return { rewrite: vi.fn(rewrite) } as unknown as Parameters<typeof handler>[1];
}

function get(path: string, headers?: Record<string, string>) {
  return new Request(`https://explorer.opentelemetry.io${path}`, { headers });
}

// The routes manifest is cached in module scope, so load a fresh module instance
// per test that exercises the HTML-injection branch to keep them isolated.
async function freshHandler(): Promise<Handler> {
  vi.resetModules();
  const mod = await import("../agent-negotiation");
  return mod.default;
}

// Minimal SPA shell mirroring the static tags in index.html that the edge overwrites.
const SHELL = `<!doctype html><html lang="en"><head>
<meta name="description" content="default description" />
<meta property="og:title" content="OpenTelemetry Ecosystem Explorer" />
<meta property="og:description" content="default og description" />
<meta property="og:url" content="https://explorer.opentelemetry.io/" />
<meta name="twitter:title" content="OpenTelemetry Ecosystem Explorer" />
<meta name="twitter:description" content="default twitter description" />
<title>OpenTelemetry Ecosystem Explorer</title>
</head><body><div id="root"></div></body></html>`;

const htmlShell = () =>
  new Response(SHELL, { status: 200, headers: { "content-type": "text/html" } });

// Dispatches rewrite() by path: routes.json returns `routes`, everything else the shell.
function htmlContext(routes: Record<string, { title: string; description: string }>) {
  return contextWith(async (path) => {
    if (path === "/seo/routes.json") {
      return new Response(JSON.stringify(routes), { status: 200 });
    }
    return htmlShell();
  });
}

// Like htmlContext, but also serves Markdown from `mdByPath` (path -> markdown)
// so the body-injection branch can be exercised.
function htmlContextWithMd(
  routes: Record<string, { title: string; description: string }>,
  mdByPath: Record<string, string>
) {
  return contextWith(async (path) => {
    if (path === "/seo/routes.json") {
      return new Response(JSON.stringify(routes), { status: 200 });
    }
    if (mdByPath[path]) {
      return new Response(mdByPath[path], {
        status: 200,
        headers: { "content-type": "text/markdown" },
      });
    }
    return htmlShell();
  });
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

  it("prefers the page's own markdown for a detail path with Accept: text/markdown", async () => {
    const context = contextWith(async (path) => {
      if (path === "/collector/components/contrib/kafkaexporter.md") {
        return new Response("# Kafka Exporter", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      return htmlShell();
    });
    const res = await handler(
      get("/collector/components/contrib/kafkaexporter", { accept: "text/markdown" }),
      context
    );
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toBe("text/markdown; charset=UTF-8");
    expect(await res!.text()).toContain("# Kafka Exporter");
  });
});

describe("agent-negotiation HTML metadata injection", () => {
  it("injects per-route title/description/OG/canonical for a known route", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/collector"),
      htmlContext({ "/collector": { title: "Collector — X", description: "Browse components." } })
    );
    expect(res?.status).toBe(200);
    const html = await res!.text();
    expect(html).toContain("<title>Collector — X</title>");
    expect(html).toContain('property="og:title" content="Collector — X"');
    expect(html).toContain('name="description" content="Browse components."');
    expect(html).toContain('rel="canonical" href="https://explorer.opentelemetry.io/collector"');
    expect(html).toContain(
      'type="text/markdown" href="https://explorer.opentelemetry.io/collector.md"'
    );
    expect(html).toContain("application/ld+json");
  });

  it("returns a real 404 for an unknown detail path (fixes soft 404)", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/collector/components/contrib/does-not-exist-xyz"),
      htmlContext({ "/collector/components/contrib/real": { title: "R", description: "d" } })
    );
    expect(res?.status).toBe(404);
  });

  it("treats a versioned Collector list path as known (200)", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/collector/components/0.156.0"),
      htmlContext({ "/": { title: "Home", description: "d" } })
    );
    expect(res?.status).toBe(200);
  });

  it("normalizes /index.html and trailing slashes to the canonical route", async () => {
    const routes = {
      "/": { title: "Home", description: "d" },
      "/collector": { title: "Collector — X", description: "d" },
    };

    const home = await freshHandler();
    const homeRes = await home(get("/index.html"), htmlContext(routes));
    expect(homeRes?.status).toBe(200);
    expect(await homeRes!.text()).toContain(
      'rel="canonical" href="https://explorer.opentelemetry.io/"'
    );

    const slashed = await freshHandler();
    const slashedRes = await slashed(get("/collector/"), htmlContext(routes));
    expect(slashedRes?.status).toBe(200);
    const html = await slashedRes!.text();
    expect(html).toContain("<title>Collector — X</title>");
    expect(html).toContain('rel="canonical" href="https://explorer.opentelemetry.io/collector"');
  });

  it("passes through asset requests untouched", async () => {
    const handler = await freshHandler();
    const context = contextWith(async () => htmlShell());
    const res = await handler(get("/assets/index-abc123.js"), context);
    expect(res).toBeUndefined();
  });

  it("serves 200 (no false 404) when the routes manifest is unavailable", async () => {
    const handler = await freshHandler();
    const context = contextWith(async (path) => {
      if (path === "/seo/routes.json") return new Response("missing", { status: 404 });
      return htmlShell();
    });
    const res = await handler(get("/collector/components/contrib/anything"), context);
    expect(res?.status).toBe(200);
  });
});

describe("agent-negotiation body injection", () => {
  const DETAIL_MD = [
    "# Kafka Exporter",
    "",
    "<!-- llms-txt-link: /llms.txt -->",
    "",
    "> OpenTelemetry Collector exporter · contrib distribution",
    "",
    "- **Type**: exporter",
    "- **Component ID**: `contrib-kafkaexporter`",
    "",
    "## Stability",
    "",
    "| Level | Signals |",
    "| --- | --- |",
    "| beta | logs, metrics |",
  ].join("\n");

  it("injects the route's Markdown into #root as HTML (headings, list, table, inline)", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/collector/components/contrib/kafkaexporter"),
      htmlContextWithMd(
        {
          "/collector/components/contrib/kafkaexporter": {
            title: "Kafka Exporter",
            description: "d",
          },
        },
        { "/collector/components/contrib/kafkaexporter.md": DETAIL_MD }
      )
    );
    expect(res?.status).toBe(200);
    const html = await res!.text();
    // Root is no longer an empty SPA shell.
    expect(html).not.toContain('<div id="root"></div>');
    expect(html).toContain("<h1>Kafka Exporter</h1>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<strong>Type</strong>");
    expect(html).toContain("<code>contrib-kafkaexporter</code>");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Level</th>");
    expect(html).toContain("<td>beta</td>");
    // The llms-txt-link HTML comment is stripped, not rendered as text.
    expect(html).not.toContain("llms-txt-link");
    // Injected for agents but hidden from human visitors (no flash) and from
    // screen readers, and inert so it can't be tabbed into before React mounts,
    // while the text stays in the HTML for HTTP fetchers.
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("clip:rect(0,0,0,0)");
    expect(html).toContain("<div inert ");
  });

  it("falls back to a title/description body for a known route without Markdown", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/collector"),
      htmlContext({ "/collector": { title: "Collector — X", description: "Browse components." } })
    );
    expect(res?.status).toBe(200);
    const html = await res!.text();
    expect(html).not.toContain('<div id="root"></div>');
    expect(html).toContain("<h1>Collector — X</h1>");
    expect(html).toContain("Browse components.");
    expect(html).toContain('<a href="/llms.txt">/llms.txt</a>');
  });

  it("injects a not-found body (and directive) on a 404", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/collector/components/contrib/does-not-exist-xyz"),
      htmlContextWithMd(
        { "/collector/components/contrib/real": { title: "R", description: "d" } },
        {}
      )
    );
    expect(res?.status).toBe(404);
    const html = await res!.text();
    expect(html).not.toContain('<div id="root"></div>');
    expect(html).toContain("<h1>Page not found</h1>");
    expect(html).toContain('<a href="/llms.txt">/llms.txt</a>');
  });

  it("does not hang on a stray '|' line that is not a table (renders it as a paragraph)", async () => {
    const handler = await freshHandler();
    // A leading "|" with no "| --- |" separator on the next line hits isBlockStart
    // but no block handler — the paragraph branch must still advance.
    const md = ["# Title", "", "| not a real table row", "", "Trailing prose."].join("\n");
    const res = await handler(
      get("/collector/components/contrib/kafkaexporter"),
      htmlContextWithMd(
        {
          "/collector/components/contrib/kafkaexporter": {
            title: "Kafka Exporter",
            description: "d",
          },
        },
        { "/collector/components/contrib/kafkaexporter.md": md }
      )
    );
    expect(res?.status).toBe(200);
    const html = await res!.text();
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<p>| not a real table row</p>");
    expect(html).toContain("<p>Trailing prose.</p>");
    expect(html).not.toContain("<table>");
  });

  it("aligns the homepage's Markdown alternate/injection with /index.md (not /llms.txt)", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/"),
      htmlContextWithMd(
        { "/": { title: "Home", description: "d" } },
        { "/index.md": "# Home\n\nWelcome to the explorer." }
      )
    );
    expect(res?.status).toBe(200);
    const html = await res!.text();
    // Advertised alternate + in-body directive both point at /index.md.
    expect(html).toContain(
      'rel="alternate" type="text/markdown" href="https://explorer.opentelemetry.io/index.md"'
    );
    expect(html).toContain('href="https://explorer.opentelemetry.io/index.md"');
    // The injected body is the homepage Markdown, not the llms.txt index.
    expect(html).toContain("<h1>Home</h1>");
    expect(html).toContain("Welcome to the explorer.");
  });

  it("merges Accept into an existing Vary header instead of overwriting it", async () => {
    const handler = await freshHandler();
    const context = contextWith(async (path) => {
      if (path === "/seo/routes.json") {
        return new Response(JSON.stringify({ "/collector": { title: "C", description: "d" } }), {
          status: 200,
        });
      }
      return new Response(SHELL, {
        status: 200,
        headers: { "content-type": "text/html", vary: "Accept-Encoding" },
      });
    });
    const res = await handler(get("/collector"), context);
    const vary = res!.headers.get("vary") ?? "";
    expect(vary).toContain("Accept-Encoding");
    expect(vary).toContain("Accept");
  });

  it("drops unsafe link schemes (javascript:) from injected Markdown, keeping safe ones", async () => {
    const handler = await freshHandler();
    const md = [
      "# Title",
      "",
      "- [click me](javascript:alert(1))",
      "- [protocol relative](//evil.example)",
      "- [safe](/data/x.json)",
      "- [external](https://example.com)",
    ].join("\n");
    const res = await handler(
      get("/collector/components/contrib/kafkaexporter"),
      htmlContextWithMd(
        {
          "/collector/components/contrib/kafkaexporter": {
            title: "Kafka Exporter",
            description: "d",
          },
        },
        { "/collector/components/contrib/kafkaexporter.md": md }
      )
    );
    const html = await res!.text();
    // Unsafe hrefs never become anchors; the label survives as plain text.
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('href="//evil.example"');
    expect(html).toContain("click me");
    expect(html).toContain("protocol relative");
    // Safe links still render.
    expect(html).toContain('<a href="/data/x.json">safe</a>');
    expect(html).toContain('<a href="https://example.com">external</a>');
  });

  it("retries loading the routes manifest after a transient failure", async () => {
    const handler = await freshHandler();
    let attempt = 0;
    const context = contextWith(async (path) => {
      if (path === "/seo/routes.json") {
        attempt++;
        if (attempt === 1) return new Response("boom", { status: 500 });
        return new Response(
          JSON.stringify({
            "/collector/components/contrib/real": { title: "R", description: "d" },
          }),
          { status: 200 }
        );
      }
      return htmlShell();
    });
    // First request: manifest fails, so every page is treated as known (200).
    const res1 = await handler(get("/collector/components/contrib/does-not-exist"), context);
    expect(res1?.status).toBe(200);
    // Second request: the manifest loads (retry, not a permanent latch), so the
    // unknown route now returns a real 404.
    const res2 = await handler(get("/collector/components/contrib/does-not-exist"), context);
    expect(res2?.status).toBe(404);
    expect(attempt).toBe(2);
  });
});

describe("agent-negotiation content negotiation", () => {
  it("serves the homepage's own Markdown (/index.md) for Accept: text/markdown on /", async () => {
    const context = contextWith(async (path) => {
      if (path === "/index.md") {
        return new Response("# Home", { status: 200, headers: { "content-type": "text/plain" } });
      }
      return htmlShell();
    });
    const res = await handler(get("/", { accept: "text/markdown" }), context);
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toBe("text/markdown; charset=UTF-8");
    expect(await res!.text()).toContain("# Home");
  });

  it("falls back to /llms.txt for / when /index.md is missing", async () => {
    const context = contextWith(async (path) => {
      if (path === "/llms.txt") {
        return new Response("# Index", { status: 200, headers: { "content-type": "text/plain" } });
      }
      return htmlShell(); // /index.md resolves to the SPA shell => treated as missing
    });
    const res = await handler(get("/", { accept: "text/markdown" }), context);
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
    expect(await res!.text()).toContain("# Index");
  });
});
