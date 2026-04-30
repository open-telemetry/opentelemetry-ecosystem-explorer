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

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');
const agentDir = path.join(distDir, 'agent');


/**
 * Generates agent-accessible documentation in the dist directory.
 * This includes llms.txt and category-specific markdown indexes that
 * link to the underlying structured JSON data.
 */
async function generateDocs() {
  console.log('Generating Agent Markdown Docs...');
  
  await fs.mkdir(agentDir, { recursive: true });

  const collectorIndexRaw = await fs.readFile(
    path.join(publicDir, 'data/collector/index.json'),
    'utf-8'
  );
  const collectorIndex = JSON.parse(collectorIndexRaw);

  let collectorMd = `# Collector Components\n\nThis is an index of all OpenTelemetry Collector components.\nFor full configuration details, please refer to the raw JSON data.\n\n## Components\n\n| Display Name | ID | Stability | JSON Data URL |\n| --- | --- | --- | --- |\n`;
  
  for (const comp of collectorIndex.components) {
    const displayName = comp.display_name || comp.name || 'Unknown';
    collectorMd += `| ${displayName} | \`${comp.id}\` | \`${comp.stability}\` | [/data/collector/components/${comp.id}.json](/data/collector/components/${comp.id}.json) |\n`;
  }

  collectorMd += `\n## Navigating Versions\n\nTo explore specific versions, fetch the versions index at [/data/collector/versions-index.json](/data/collector/versions-index.json).\n`;
  await fs.writeFile(path.join(agentDir, 'collector.md'), collectorMd);
  console.log(' - Generated dist/agent/collector.md');

  // Resolve the latest version to generate a current instrumentation index
  const javaagentVersionsRaw = await fs.readFile(
    path.join(publicDir, 'data/javaagent/versions-index.json'),
    'utf-8'
  );
  const javaagentVersions = JSON.parse(javaagentVersionsRaw);
  const latestVersion = javaagentVersions.versions.find((v) => v.is_latest)?.version;

  let javaagentMd = `# Java Agent Instrumentations\n\nThis is an index of all OpenTelemetry Java Agent instrumentations.\nFor full configuration details, please refer to the raw JSON data.\n\n## Components\n\n| Display Name | ID | JSON Data URL |\n| --- | --- | --- |\n`;

  if (latestVersion) {
    const manifestRaw = await fs.readFile(
      path.join(publicDir, `data/javaagent/versions/${latestVersion}-index.json`),
      'utf-8'
    );
    const manifest = JSON.parse(manifestRaw);

    // Merge core and custom instrumentations for a complete index
    const allInstrumentations = { ...manifest.instrumentations, ...manifest.custom_instrumentations };
    
    for (const [id, hash] of Object.entries(allInstrumentations)) {
      let displayName = id;
      try {
        const compRaw = await fs.readFile(
          path.join(publicDir, `data/javaagent/instrumentations/${id}/${id}-${hash}.json`),
          'utf-8'
        );
        const comp = JSON.parse(compRaw);
        if (comp.display_name) displayName = comp.display_name;
      } catch (e) {}
      
      javaagentMd += `| ${displayName} | \`${id}\` | [/data/javaagent/instrumentations/${id}/${id}-${hash}.json](/data/javaagent/instrumentations/${id}/${id}-${hash}.json) |\n`;
    }
  }

  javaagentMd += `\n## Navigating Versions\n\nTo explore specific versions or see a changelog of components, fetch the versions index at [/data/javaagent/versions-index.json](/data/javaagent/versions-index.json).\n`;
  await fs.writeFile(path.join(agentDir, 'javaagent.md'), javaagentMd);
  console.log(' - Generated dist/agent/javaagent.md');

  const llmsTxt = `# OpenTelemetry Ecosystem Explorer

This site contains metadata about the OpenTelemetry ecosystem.
For agent consumption, we provide index files that point to our structured JSON datasets:

- [Collector Components](/agent/collector.md)
- [Java Agent Instrumentations](/agent/javaagent.md)
`;
  await fs.writeFile(path.join(distDir, 'llms.txt'), llmsTxt);
  console.log(' - Generated dist/llms.txt');
}

generateDocs().catch(console.error);
