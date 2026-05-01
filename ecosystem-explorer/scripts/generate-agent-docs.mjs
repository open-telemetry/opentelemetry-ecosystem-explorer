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
function buildCollectorIndex(components) {
  let md = `# Collector Components\n\nThis is an index of all OpenTelemetry Collector components.\nFor full configuration details, please refer to the raw JSON data.\n\n## Components\n\n| Display Name | ID | Stability | JSON Data URL |\n| --- | --- | --- | --- |\n`;

  for (const comp of components) {
    const displayName = comp.display_name || comp.name || "Unknown";
    md += `| ${displayName} | \`${comp.id}\` | \`${comp.stability}\` | [/data/collector/components/${comp.id}.json](/data/collector/components/${comp.id}.json) |\n`;
  }

  md += `\n## Navigating Versions\n\nTo explore specific versions, refer to the [Versions Index](/agent/collector/versions.md).\n`;
  return md;
}

/**
 * Builds the Collector versions index markdown.
 */
function buildCollectorVersions(versions) {
  let md = `# Collector Versions\n\nThis is an index of available OpenTelemetry Collector versions.\n\n| Version | Index URL | Is Latest |\n| --- | --- | --- |\n`;
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
  let md = `# Java Agent Instrumentations\n\nThis is an index of all OpenTelemetry Java Agent instrumentations.\nFor full configuration details, please refer to the raw JSON data.\n\n## Components\n\n| Display Name | ID | JSON Data URL |\n| --- | --- | --- |\n`;

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
  let md = `# Java Agent Versions\n\nThis is an index of available OpenTelemetry Java Agent versions.\n\n| Version | Index URL | Is Latest |\n| --- | --- | --- |\n`;
  for (const v of versions) {
    md += `| ${v.version} | [/data/javaagent/versions/${v.version}-index.json](/data/javaagent/versions/${v.version}-index.json) | ${v.is_latest ? "Yes" : "No"} |\n`;
  }
  return md;
}

/**
 * Builds the root llms.txt markdown.
 */
function buildLlmsTxt() {
  return `# OpenTelemetry Ecosystem Explorer

This site contains metadata about the OpenTelemetry ecosystem.
For agent consumption, we provide index files that point to our structured JSON datasets:

- [Collector Components](/agent/collector/index.md)
- [Collector Versions](/agent/collector/versions.md)
- [Java Agent Instrumentations](/agent/javaagent/index.md)
- [Java Agent Versions](/agent/javaagent/versions.md)

## Navigation Patterns

Agents can fetch specific component data using the following URL patterns:

- **Collector Components**: \`/data/collector/components/{id}.json\`
- **Java Agent Instrumentations**: \`/data/javaagent/instrumentations/{id}/{id}-{hash}.json\`

## Version Comparison Guide

To find what changed in a component between versions, compare its hash in the two version index JSONs; different hashes mean the component changed.
`;
}

/**
 * Generates agent-accessible documentation in the dist directory.
 */
async function generateDocs() {
  console.log("Generating Agent Markdown Docs...");

  await fs.mkdir(collectorAgentDir, { recursive: true });
  await fs.mkdir(javaagentAgentDir, { recursive: true });

  // Load Data
  const collectorIndex = JSON.parse(
    await fs.readFile(path.join(publicDir, "data/collector/index.json"), "utf-8")
  );
  const collectorVersions = JSON.parse(
    await fs.readFile(path.join(publicDir, "data/collector/versions-index.json"), "utf-8")
  );
  const javaagentVersions = JSON.parse(
    await fs.readFile(path.join(publicDir, "data/javaagent/versions-index.json"), "utf-8")
  );

  // Generate MD files
  await fs.writeFile(
    path.join(collectorAgentDir, "index.md"),
    buildCollectorIndex(collectorIndex.components)
  );
  console.log(" - Generated dist/agent/collector/index.md");

  await fs.writeFile(
    path.join(collectorAgentDir, "versions.md"),
    buildCollectorVersions(collectorVersions.versions)
  );
  console.log(" - Generated dist/agent/collector/versions.md");

  await fs.writeFile(
    path.join(javaagentAgentDir, "index.md"),
    await buildJavaAgentIndex(javaagentVersions.versions, publicDir)
  );
  console.log(" - Generated dist/agent/javaagent/index.md");

  await fs.writeFile(
    path.join(javaagentAgentDir, "versions.md"),
    buildJavaAgentVersions(javaagentVersions.versions)
  );
  console.log(" - Generated dist/agent/javaagent/versions.md");

  await fs.writeFile(path.join(distDir, "llms.txt"), buildLlmsTxt());
  console.log(" - Generated dist/llms.txt");
}

generateDocs().catch(console.error);
