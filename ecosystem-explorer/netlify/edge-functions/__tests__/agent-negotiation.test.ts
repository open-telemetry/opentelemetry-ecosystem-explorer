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
import { describe, it, expect, vi, afterEach } from "vitest";
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

// Mirrors a HEAD request reaching origin: context.rewrite() carries the method
// through, so every rewrite — the shell, the Markdown probe, and the manifest —
// resolves with headers only. The handler therefore fetches /seo/routes.json
// with an explicit GET, which this stubs; nothing else may go over fetch().
function headContextWithMd(
  routes: Record<string, { title: string; description: string }>,
  mdPaths: string[]
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      expect(String(input)).toBe("https://explorer.opentelemetry.io/seo/routes.json");
      expect(init?.method).toBe("GET");
      return new Response(JSON.stringify(routes), { status: 200 });
    })
  );
  return contextWith(async (path) => {
    if (mdPaths.includes(path)) {
      return new Response(null, { status: 200, headers: { "content-type": "text/markdown" } });
    }
    return new Response(null, { status: 200, headers: { "content-type": "text/html" } });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const head = (path: string) =>
  new Request(`https://explorer.opentelemetry.io${path}`, { method: "HEAD" });

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

  it("keeps the 404 explanation in the body for GET", async () => {
    const context = contextWith(
      async () =>
        new Response("<!doctype html><html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
    );
    const res = await handler(get("/agent/nope.md"), context);
    expect(res?.status).toBe(404);
    expect(await res!.text()).toBe("Not Found");
  });

  it("returns a bodyless 404 for HEAD on an asset path", async () => {
    const context = contextWith(
      async () => new Response(null, { status: 200, headers: { "content-type": "text/html" } })
    );
    const res = await handler(head("/agent/nope.md"), context);
    expect(res?.status).toBe(404);
    expect(res?.body).toBeNull();
    expect(await res!.text()).toBe("");
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
      htmlContextWithMd(
        { "/collector": { title: "Collector — X", description: "Browse components." } },
        { "/collector.md": "# Collector" }
      )
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

describe("agent-negotiation section-index fallback is gated on real routes", () => {
  const COLLECTOR_INDEX = "# All Collector components";

  // routes.json plus the Collector section index; every other path is the SPA shell.
  const indexContext = (routes: Record<string, { title: string; description: string }>) =>
    htmlContextWithMd(routes, { "/agent/collector/index.md": COLLECTOR_INDEX });

  it("returns 404 instead of the section index for a fabricated path", async () => {
    const handler = await freshHandler();
    // Not a route in either route table: the Collector detail route is
    // /collector/components/:distribution/:name, with no version segment.
    const res = await handler(
      get("/collector/components/v0.140.0/contrib/kafkareceiver", { accept: "text/markdown" }),
      indexContext({
        "/collector/components/contrib/kafkareceiver": { title: "K", description: "d" },
      })
    );
    expect(res?.status).toBe(404);
    expect(await res!.text()).not.toContain(COLLECTOR_INDEX);
  });

  it("still serves the section index for a known route with no Markdown page", async () => {
    const handler = await freshHandler();
    // Versioned Collector list: a real client-side route, absent from routes.json.
    const res = await handler(
      get("/collector/components/0.156.0", { accept: "text/markdown" }),
      indexContext({ "/collector/components": { title: "C", description: "d" } })
    );
    expect(res?.status).toBe(200);
    expect(await res!.text()).toContain(COLLECTOR_INDEX);
  });

  it("keeps the /javaagent alias resolving to the Java section index", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/javaagent", { accept: "text/markdown" }),
      htmlContextWithMd(
        { "/java-agent": { title: "Java Agent", description: "d" } },
        { "/agent/javaagent/index.md": "# All Java agent instrumentations" }
      )
    );
    expect(res?.status).toBe(200);
    expect(await res!.text()).toContain("# All Java agent instrumentations");
  });

  it("404s a fabricated path under the /javaagent alias", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/javaagent/not/a/route", { accept: "text/markdown" }),
      htmlContextWithMd(
        { "/java-agent": { title: "Java Agent", description: "d" } },
        { "/agent/javaagent/index.md": "# All Java agent instrumentations" }
      )
    );
    expect(res?.status).toBe(404);
  });

  it("serves the section index when the routes manifest is unavailable", async () => {
    const handler = await freshHandler();
    const context = contextWith(async (path) => {
      if (path === "/seo/routes.json") return new Response("missing", { status: 404 });
      if (path === "/agent/collector/index.md") {
        return new Response(COLLECTOR_INDEX, {
          status: 200,
          headers: { "content-type": "text/markdown" },
        });
      }
      return htmlShell();
    });
    const res = await handler(
      get("/collector/components/anything/at/all", { accept: "text/markdown" }),
      context
    );
    expect(res?.status).toBe(200);
    expect(await res!.text()).toContain(COLLECTOR_INDEX);
  });
});

describe("agent-negotiation legacy Java version route", () => {
  it("issues a real 301 to the query-param shape", async () => {
    const context = contextWith(async () => htmlShell());
    const res = await handler(get("/java-agent/instrumentation/2.31.1/apache-dubbo-2.7"), context);
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe(
      "/java-agent/instrumentation/apache-dubbo-2.7?version=2.31.1"
    );
  });

  it("redirects Markdown requests and the `latest` alias too", async () => {
    const context = contextWith(async () => htmlShell());
    const res = await handler(
      get("/java-agent/instrumentation/latest/apache-dubbo-2.7", { accept: "text/markdown" }),
      context
    );
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe(
      "/java-agent/instrumentation/apache-dubbo-2.7?version=latest"
    );
  });

  it("preserves other query parameters", async () => {
    const context = contextWith(async () => htmlShell());
    const res = await handler(
      get("/java-agent/instrumentation/2.31.1/apache-dubbo-2.7?tab=config"),
      context
    );
    expect(res?.headers.get("location")).toBe(
      "/java-agent/instrumentation/apache-dubbo-2.7?tab=config&version=2.31.1"
    );
  });

  it("does not redirect a two-segment path whose first segment is not a version", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/java-agent/instrumentation/not-a-version/apache-dubbo-2.7"),
      htmlContext({ "/java-agent/instrumentation": { title: "J", description: "d" } })
    );
    expect(res?.status).toBe(404);
  });
});

describe("agent-negotiation Markdown alternate advertising", () => {
  const routes = { "/collector": { title: "Collector — X", description: "d" } };

  it("sets a Link: rel=alternate header when the route has Markdown", async () => {
    const handler = await freshHandler();
    const res = await handler(
      get("/collector"),
      htmlContextWithMd(routes, { "/collector.md": "# Collector" })
    );
    expect(res?.headers.get("link")).toBe(
      '<https://explorer.opentelemetry.io/collector.md>; rel="alternate"; type="text/markdown"'
    );
  });

  it("answers a HEAD request with the same header", async () => {
    const handler = await freshHandler();
    const res = await handler(head("/collector"), headContextWithMd(routes, ["/collector.md"]));
    expect(res?.status).toBe(200);
    expect(res?.headers.get("link")).toContain('rel="alternate"');
  });

  it("answers a HEAD request with headers only, no body", async () => {
    const handler = await freshHandler();
    const res = await handler(head("/collector"), headContextWithMd(routes, ["/collector.md"]));
    expect(res?.status).toBe(200);
    expect(res?.body).toBeNull();
    expect(await res!.text()).toBe("");
    expect(res?.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res?.headers.get("content-length")).toBeNull();
  });

  it("advertises the alternate on HEAD even though the rewrites come back bodyless", async () => {
    const handler = await freshHandler();
    const res = await handler(head("/collector"), headContextWithMd(routes, ["/collector.md"]));
    expect(res?.status).toBe(200);
    expect(res?.headers.get("link")).toBe(
      '<https://explorer.opentelemetry.io/collector.md>; rel="alternate"; type="text/markdown"'
    );
    expect(res?.body).toBeNull();
  });

  it("advertises no alternate on HEAD for a known route without Markdown", async () => {
    const handler = await freshHandler();
    const res = await handler(head("/collector"), headContextWithMd(routes, []));
    expect(res?.status).toBe(200);
    expect(res?.headers.get("link")).toBeNull();
  });

  it("returns a bodyless 404 for an unknown route on HEAD", async () => {
    const handler = await freshHandler();
    const context = headContextWithMd(routes, []);
    const res = await handler(head("/nope-xyz"), context);
    expect(res?.status).toBe(404);
    expect(res?.body).toBeNull();
    // The manifest must come from the GET fetch, not from a rewrite that HEAD
    // would answer bodyless — an unparsed manifest makes every path look known.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(context.rewrite).not.toHaveBeenCalledWith("/seo/routes.json");
  });

  it("404s a fabricated section path on HEAD with Accept: text/markdown", async () => {
    const handler = await freshHandler();
    const request = new Request("https://explorer.opentelemetry.io/collector/nope-xyz", {
      method: "HEAD",
      headers: { accept: "text/markdown" },
    });
    const res = await handler(request, headContextWithMd(routes, []));
    expect(res?.status).toBe(404);
    expect(res?.body).toBeNull();
  });

  it("advertises no alternate for a known route without a Markdown page", async () => {
    const handler = await freshHandler();
    const res = await handler(get("/collector"), htmlContext(routes));
    expect(res?.status).toBe(200);
    expect(res?.headers.get("link")).toBeNull();
    const html = await res!.text();
    expect(html).not.toContain('rel="alternate"');
    // The llms.txt directive still renders, without the dangling Markdown claim.
    expect(html).toContain('<a href="/llms.txt">/llms.txt</a>');
    expect(html).not.toContain("A Markdown version of this page");
  });

  it("advertises no alternate on a 404", async () => {
    const handler = await freshHandler();
    const res = await handler(get("/collector/components/contrib/nope-xyz"), htmlContext(routes));
    expect(res?.status).toBe(404);
    expect(res?.headers.get("link")).toBeNull();
    expect(await res!.text()).not.toContain('rel="alternate"');
  });
});
