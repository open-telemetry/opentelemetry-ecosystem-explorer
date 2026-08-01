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

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { STATIC_ROUTE_META } from "../src/lib/seo/derive.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const distDir = path.join(rootDir, "dist");
const agentDir = path.join(distDir, "agent");
const collectorAgentDir = path.join(agentDir, "collector");
const javaagentAgentDir = path.join(agentDir, "javaagent");

/**
 * Builds the Collector components index markdown.
 */
async function buildCollectorIndex(components, publicPath) {
  const versionsRaw = await fs.readFile(
    path.join(publicPath, "data/collector/versions-index.json"),
    "utf-8"
  );
  const { versions } = JSON.parse(versionsRaw);
  const latestVersion = versions.find((v) => v.is_latest)?.version;

  let componentHashes = {};
  if (latestVersion) {
    const manifestRaw = await fs.readFile(
      path.join(publicPath, `data/collector/versions/${latestVersion}-index.json`),
      "utf-8"
    );
    const manifest = JSON.parse(manifestRaw);
    componentHashes = manifest.components || {};
  }

  let md = `> For the complete documentation index, see [llms.txt](/llms.txt)\n\n# Collector Components\n\n<!-- llms-txt-link: /llms.txt -->\n\nThis is an index of all OpenTelemetry Collector components.\nFor full configuration details, please refer to the raw JSON data.\n\n**JSON Schema**: [collector-component.schema.json](/schemas/collector-component.schema.json)\n\n## Components\n\n| Display Name | ID | Stability | JSON Data URL |\n| --- | --- | --- | --- |\n`;

  for (const comp of components) {
    const displayName = comp.display_name || comp.name || "Unknown";
    const hash = componentHashes[comp.id];

    if (!hash) {
      console.warn(`[WARN] Missing hash for collector component: ${comp.id}`);
    }

    const jsonUrl = hash
      ? `/data/collector/components/${comp.id}/${comp.id}-${hash}.json`
      : `/data/collector/components/${comp.id}.json`; // Fallback (likely broken if files are only hashed)

    md += `| ${displayName} | \`${comp.id}\` | \`${comp.stability}\` | [${jsonUrl}](${jsonUrl}) |\n`;
  }

  md += `\n## Navigating Versions\n\nTo explore specific versions, refer to the [Versions Index](/agent/collector/versions.md).\n`;
  return md;
}

/**
 * Builds the Collector versions index markdown.
 */
function buildCollectorVersions(versions) {
  let md = `# Collector Versions\n\n<!-- llms-txt-link: /llms.txt -->\n\nThis is an index of available OpenTelemetry Collector versions.\n\n| Version | Index URL | Is Latest |\n| --- | --- | --- |\n`;
  for (const v of versions) {
    md += `| ${v.version} | [/data/collector/versions/${v.version}-index.json](/data/collector/versions/${v.version}-index.json) | ${v.is_latest ? "Yes" : "No"} |\n`;
  }
  return md;
}

/**
 * Builds the Java Agent instrumentations index markdown.
 */
async function buildJavaAgentIndex(versions, publicPath) {
  const latestVersion = versions.find((v) => v.is_latest)?.version;
  let md = `> For the complete documentation index, see [llms.txt](/llms.txt)\n\n# Java Agent Instrumentations\n\n<!-- llms-txt-link: /llms.txt -->\n\nThis is an index of all OpenTelemetry Java Agent instrumentations.\nFor full configuration details, please refer to the raw JSON data.\n\n**JSON Schema**: [javaagent-instrumentation.schema.json](/schemas/javaagent-instrumentation.schema.json)\n\n## Components\n\n| Display Name | ID | JSON Data URL |\n| --- | --- | --- |\n`;

  if (latestVersion) {
    const manifestRaw = await fs.readFile(
      path.join(publicPath, `data/javaagent/versions/${latestVersion}-index.json`),
      "utf-8"
    );
    const manifest = JSON.parse(manifestRaw);

    const allInstrumentations = {
      ...manifest.instrumentations,
      ...manifest.custom_instrumentations,
    };

    for (const [id, hash] of Object.entries(allInstrumentations)) {
      let displayName = id;
      try {
        const compRaw = await fs.readFile(
          path.join(publicPath, `data/javaagent/instrumentations/${id}/${id}-${hash}.json`),
          "utf-8"
        );
        const comp = JSON.parse(compRaw);
        if (comp.display_name) displayName = comp.display_name;
      } catch (e) {}

      md += `| ${displayName} | \`${id}\` | [/data/javaagent/instrumentations/${id}/${id}-${hash}.json](/data/javaagent/instrumentations/${id}/${id}-${hash}.json) |\n`;
    }
  }

  md += `\n## Navigating Versions\n\nTo explore specific versions or see a changelog of components, refer to the [Versions Index](/agent/javaagent/versions.md).\n`;
  return md;
}

/**
 * Builds the Java Agent versions index markdown.
 */
function buildJavaAgentVersions(versions) {
  let md = `# Java Agent Versions\n\n<!-- llms-txt-link: /llms.txt -->\n\nThis is an index of available OpenTelemetry Java Agent versions.\n\n| Version | Index URL | Is Latest |\n| --- | --- | --- |\n`;
  for (const v of versions) {
    md += `| ${v.version} | [/data/javaagent/versions/${v.version}-index.json](/data/javaagent/versions/${v.version}-index.json) | ${v.is_latest ? "Yes" : "No"} |\n`;
  }
  return md;
}

/**
 * Builds the root llms.txt markdown.
 *
 * `collectorPages` / `javaPages` are `{ label, pageUrl }` lists for every
 * latest-version detail page. They are listed here (matching the sitemap URLs)
 * so the file provides full coverage of the site's documented pages; each page
 * URL also serves Markdown when its `.md` suffix is appended. (The edge function
 * only negotiates `Accept: text/markdown` for the section index pages, not for
 * individual component/instrumentation or top-level pages, so those are
 * documented with the `.md` suffix only.)
 */
function buildLlmsTxt(staticPages, collectorPages, javaPages) {
  const pageList = (pages) =>
    pages.map(({ label, pageUrl }) => `- [${label}](${pageUrl})`).join("\n");

  return `# OpenTelemetry Ecosystem Explorer

<!-- llms-full-txt-link: /llms-full.txt -->

> This site contains metadata about the OpenTelemetry ecosystem.

For agent consumption, we provide index files that point to our structured JSON datasets:

- [Collector Components](/agent/collector/index.md)
- [Collector Versions](/agent/collector/versions.md)
- [Java Agent Instrumentations](/agent/javaagent/index.md)
- [Java Agent Versions](/agent/javaagent/versions.md)

**For a single-file version of all documentation, see [llms-full.txt](/llms-full.txt).**

## Pages

Top-level pages (append \`.md\` to the URL for Markdown):

${pageList(staticPages)}

## Data Schemas

To help agents parse our JSON data, we provide the following JSON Schemas:

- [Collector Component Schema](/schemas/collector-component.schema.json)
- [Java Agent Instrumentation Schema](/schemas/javaagent-instrumentation.schema.json)

## Navigation Patterns

Agents can fetch specific component data using the following URL patterns:

- **Collector Components**: \`/data/collector/components/{id}/{id}-{hash}.json\`
- **Java Agent Instrumentations**: \`/data/javaagent/instrumentations/{id}/{id}-{hash}.json\`

The {hash} for the latest version can be obtained from the version index files:
- **Collector**: \`/data/collector/versions/{version}-index.json\`
- **Java Agent**: \`/data/javaagent/versions/{version}-index.json\`

Refer to \`/data/collector/versions-index.json\` or \`/data/javaagent/versions-index.json\` to find the latest {version} and its corresponding component-to-hash mapping.

## Version Comparison Guide

To find what changed in a component between versions, compare its hash in the two version index JSONs; different hashes mean the component changed.

## Collector Components

Every component below has a Markdown page (append \`.md\` to the URL):

${pageList(collectorPages)}

## Java Agent Instrumentations

Every instrumentation below has a Markdown page (append \`.md\` to the URL):

${pageList(javaPages)}
`;
}

const escapeCell = (value) =>
  String(value ?? "")
    // Escape backslashes first so a literal "\" becomes "\\" before we introduce
    // our own backslash escapes for pipes (otherwise the escaping is ambiguous).
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Builds a per-component Markdown page for a Collector component. Gives agents
 * real, parseable content (name, stability, attributes) at a stable URL instead
 * of the client-rendered SPA shell.
 */
function buildCollectorComponentPage(component, jsonUrl) {
  const label = component.display_name || component.name || component.id;
  const pageUrl = `/collector/components/${component.distribution}/${component.name}`;
  const lines = [
    `# ${label}`,
    "",
    "<!-- llms-txt-link: /llms.txt -->",
    "",
    `> OpenTelemetry Collector ${component.type ?? "component"} · ${component.distribution} distribution`,
    "",
  ];
  if (component.description) {
    lines.push(component.description, "");
  }
  lines.push(
    `- **Component ID**: \`${component.id}\``,
    `- **Name**: \`${component.name}\``,
    `- **Type**: ${component.type ?? "unknown"}`,
    `- **Distribution**: ${component.distribution}`
  );
  if (component.repository) {
    lines.push(`- **Repository**: \`${component.repository}\``);
  }
  lines.push("");

  const stability = component.status?.stability;
  if (stability && Object.keys(stability).length) {
    lines.push("## Stability", "", "| Level | Signals |", "| --- | --- |");
    for (const [level, signals] of Object.entries(stability)) {
      lines.push(`| ${level} | ${escapeCell((signals || []).join(", "))} |`);
    }
    lines.push("");
  }

  const attributes = component.attributes;
  if (attributes && typeof attributes === "object" && Object.keys(attributes).length) {
    lines.push("## Attributes", "", "| Attribute | Type | Description |", "| --- | --- | --- |");
    for (const [attrName, info] of Object.entries(attributes)) {
      lines.push(
        `| \`${attrName}\` | ${escapeCell(info?.type)} | ${escapeCell(info?.description)} |`
      );
    }
    lines.push("");
  }

  lines.push(
    "## Data",
    "",
    `- **JSON**: [${jsonUrl}](${jsonUrl})`,
    `- **Explore**: [${pageUrl}](${pageUrl})`,
    ""
  );
  return lines.join("\n");
}

/**
 * Builds a per-instrumentation Markdown page for a Java agent instrumentation.
 */
function buildJavaInstrumentationPage(instr, jsonUrl) {
  const label = instr.display_name || instr.name;
  const pageUrl = `/java-agent/instrumentation/${instr.name}`;
  const lines = [
    `# ${label}`,
    "",
    "<!-- llms-txt-link: /llms.txt -->",
    "",
    "> OpenTelemetry Java agent instrumentation",
    "",
  ];
  if (instr.description) {
    lines.push(instr.description, "");
  }
  lines.push(`- **Name**: \`${instr.name}\``);
  if (instr.scope?.name) {
    lines.push(`- **Scope**: \`${instr.scope.name}\``);
  }
  if (Array.isArray(instr.javaagent_target_versions) && instr.javaagent_target_versions.length) {
    lines.push(
      `- **Target versions**: ${instr.javaagent_target_versions.map((v) => `\`${v}\``).join(", ")}`
    );
  }
  if (instr.library_link) {
    lines.push(`- **Library**: ${instr.library_link}`);
  }
  lines.push("");

  // Telemetry: collect emitted metric names and span attribute names across groups.
  const telemetry = Array.isArray(instr.telemetry) ? instr.telemetry : [];
  const metricNames = new Set();
  const spanAttrNames = new Set();
  for (const group of telemetry) {
    for (const metric of group?.metrics ?? []) {
      if (metric?.name) metricNames.add(metric.name);
    }
    for (const span of group?.spans ?? []) {
      for (const attr of span?.attributes ?? []) {
        if (attr?.name) spanAttrNames.add(attr.name);
      }
    }
  }
  if (metricNames.size || spanAttrNames.size) {
    lines.push("## Telemetry", "");
    if (metricNames.size) {
      lines.push(`- **Metrics**: ${[...metricNames].map((n) => `\`${n}\``).join(", ")}`);
    }
    if (spanAttrNames.size) {
      lines.push(`- **Span attributes**: ${[...spanAttrNames].map((n) => `\`${n}\``).join(", ")}`);
    }
    lines.push("");
  }

  const configs = Array.isArray(instr.configurations) ? instr.configurations : [];
  if (configs.length) {
    lines.push(
      "## Configuration",
      "",
      "| Option | Type | Default | Description |",
      "| --- | --- | --- | --- |"
    );
    for (const cfg of configs) {
      lines.push(
        `| \`${escapeCell(cfg?.name)}\` | ${escapeCell(cfg?.type)} | ${escapeCell(
          cfg?.default
        )} | ${escapeCell(cfg?.description)} |`
      );
    }
    lines.push("");
  }

  lines.push(
    "## Data",
    "",
    `- **JSON**: [${jsonUrl}](${jsonUrl})`,
    `- **Explore**: [${pageUrl}](${pageUrl})`,
    ""
  );
  return lines.join("\n");
}

/**
 * Builds a Markdown page for a top-level (non-parameterized) route. Content is
 * intentionally lightweight — the route's title/description plus links into the
 * agent indexes — so agents fetching `/collector.md` etc. get real content.
 */
function buildStaticRoutePage(title, description) {
  return `# ${title}

<!-- llms-txt-link: /llms.txt -->

${description}

## Explore

- [All Collector components](/agent/collector/index.md)
- [All Java agent instrumentations](/agent/javaagent/index.md)
- [Full documentation index](/llms.txt)
`;
}

/** Maps a route pathname to its Markdown file path in dist (\`/\` -> index.md). */
function staticRouteMdPath(pathname) {
  const rel = pathname === "/" ? "index.md" : `${pathname.replace(/^\//, "")}.md`;
  return path.join(distDir, rel);
}

/**
 * Generates a Markdown page for every top-level route in STATIC_ROUTE_META,
 * written at the app-route path (so `/collector.md`, `/about.md`, etc. resolve),
 * and returns the `{ label, pageUrl }` listing for llms.txt.
 */
async function generateStaticRoutePages() {
  const pages = [];
  for (const [pathname, meta] of Object.entries(STATIC_ROUTE_META)) {
    const outPath = staticRouteMdPath(pathname);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, buildStaticRoutePage(meta.title, meta.description));
    pages.push({ label: meta.title, pageUrl: pathname });
  }
  return pages;
}

/**
 * Generates a per-component Markdown page for every latest-version Collector
 * component, written at the app-route path (so `/collector/components/{d}/{n}.md`
 * resolves), and returns the `{ label, pageUrl }` listing for llms.txt.
 */
async function generateCollectorPages(publicPath) {
  const { versions } = JSON.parse(
    await fs.readFile(path.join(publicPath, "data/collector/versions-index.json"), "utf-8")
  );
  const latestVersion = versions.find((v) => v.is_latest)?.version;
  const pages = [];
  if (!latestVersion) {
    console.warn("[WARN] No latest Collector version; skipping per-component pages.");
    return pages;
  }

  const manifest = JSON.parse(
    await fs.readFile(
      path.join(publicPath, `data/collector/versions/${latestVersion}-index.json`),
      "utf-8"
    )
  );

  for (const [id, hash] of Object.entries(manifest.components || {})) {
    try {
      const component = JSON.parse(
        await fs.readFile(
          path.join(publicPath, `data/collector/components/${id}/${id}-${hash}.json`),
          "utf-8"
        )
      );
      const jsonUrl = `/data/collector/components/${id}/${id}-${hash}.json`;
      const outDir = path.join(distDir, "collector/components", component.distribution);
      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(
        path.join(outDir, `${component.name}.md`),
        buildCollectorComponentPage(component, jsonUrl)
      );
      pages.push({
        label: component.display_name || component.name,
        pageUrl: `/collector/components/${component.distribution}/${component.name}`,
      });
    } catch (e) {
      console.warn(`[WARN] Could not generate Collector page for ${id}: ${e.message}`);
    }
  }
  return pages;
}

/**
 * Generates a per-instrumentation Markdown page for every latest-version Java
 * agent instrumentation, written at `/java-agent/instrumentation/{name}.md`, and
 * returns the `{ label, pageUrl }` listing for llms.txt.
 */
async function generateJavaPages(publicPath) {
  const { versions } = JSON.parse(
    await fs.readFile(path.join(publicPath, "data/javaagent/versions-index.json"), "utf-8")
  );
  const latestVersion = versions.find((v) => v.is_latest)?.version;
  const pages = [];
  if (!latestVersion) {
    console.warn("[WARN] No latest Java agent version; skipping per-instrumentation pages.");
    return pages;
  }

  const manifest = JSON.parse(
    await fs.readFile(
      path.join(publicPath, `data/javaagent/versions/${latestVersion}-index.json`),
      "utf-8"
    )
  );
  const all = { ...manifest.instrumentations, ...manifest.custom_instrumentations };

  const outDir = path.join(distDir, "java-agent/instrumentation");
  await fs.mkdir(outDir, { recursive: true });
  for (const [name, hash] of Object.entries(all)) {
    try {
      const instr = JSON.parse(
        await fs.readFile(
          path.join(publicPath, `data/javaagent/instrumentations/${name}/${name}-${hash}.json`),
          "utf-8"
        )
      );
      const jsonUrl = `/data/javaagent/instrumentations/${name}/${name}-${hash}.json`;
      await fs.writeFile(
        path.join(outDir, `${name}.md`),
        buildJavaInstrumentationPage(instr, jsonUrl)
      );
      pages.push({
        label: instr.display_name || instr.name,
        pageUrl: `/java-agent/instrumentation/${name}`,
      });
    } catch (e) {
      console.warn(`[WARN] Could not generate Java agent page for ${name}: ${e.message}`);
    }
  }
  return pages;
}

/**
 * Generates agent-accessible documentation in the dist directory.
 */
async function generateDocs() {
  console.log("Generating Agent Markdown Docs...");

  await fs.mkdir(collectorAgentDir, { recursive: true });
  await fs.mkdir(javaagentAgentDir, { recursive: true });

  const collectorIndex = JSON.parse(
    await fs.readFile(path.join(publicDir, "data/collector/index.json"), "utf-8")
  );
  const collectorVersions = JSON.parse(
    await fs.readFile(path.join(publicDir, "data/collector/versions-index.json"), "utf-8")
  );
  const javaagentVersions = JSON.parse(
    await fs.readFile(path.join(publicDir, "data/javaagent/versions-index.json"), "utf-8")
  );

  const collectorIndexMd = await buildCollectorIndex(collectorIndex.components, publicDir);
  const collectorVersionsMd = buildCollectorVersions(collectorVersions.versions);
  const javaagentIndexMd = await buildJavaAgentIndex(javaagentVersions.versions, publicDir);
  const javaagentVersionsMd = buildJavaAgentVersions(javaagentVersions.versions);

  const staticPages = await generateStaticRoutePages();
  console.log(` - Generated ${staticPages.length} top-level route pages`);
  const collectorPages = await generateCollectorPages(publicDir);
  console.log(` - Generated ${collectorPages.length} Collector component pages`);
  const javaPages = await generateJavaPages(publicDir);
  console.log(` - Generated ${javaPages.length} Java agent instrumentation pages`);

  const llmsTxt = buildLlmsTxt(staticPages, collectorPages, javaPages);

  await fs.writeFile(path.join(collectorAgentDir, "index.md"), collectorIndexMd);
  console.log(" - Generated dist/agent/collector/index.md");

  await fs.writeFile(path.join(collectorAgentDir, "versions.md"), collectorVersionsMd);
  console.log(" - Generated dist/agent/collector/versions.md");

  await fs.writeFile(path.join(javaagentAgentDir, "index.md"), javaagentIndexMd);
  console.log(" - Generated dist/agent/javaagent/index.md");

  await fs.writeFile(path.join(javaagentAgentDir, "versions.md"), javaagentVersionsMd);
  console.log(" - Generated dist/agent/javaagent/versions.md");

  await fs.writeFile(path.join(distDir, "llms.txt"), llmsTxt);
  console.log(" - Generated dist/llms.txt");

  const llmsFullTxt = [
    llmsTxt,
    "\n---\n",
    collectorIndexMd,
    "\n---\n",
    collectorVersionsMd,
    "\n---\n",
    javaagentIndexMd,
    "\n---\n",
    javaagentVersionsMd,
  ].join("\n");

  await fs.writeFile(path.join(distDir, "llms-full.txt"), llmsFullTxt);
  console.log(" - Generated dist/llms-full.txt");
}

generateDocs().catch(console.error);
