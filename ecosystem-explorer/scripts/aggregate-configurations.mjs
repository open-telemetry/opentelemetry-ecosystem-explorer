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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INSTRUMENTATIONS_DIR = path.join(
  __dirname,
  "..",
  "public",
  "data",
  "javaagent",
  "instrumentations"
);
const OUTPUT_FILE = path.join(
  __dirname,
  "..",
  "public",
  "data",
  "javaagent",
  "global-configurations.json"
);

function findJsonFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findJsonFiles(filePath, fileList);
    } else if (filePath.endsWith(".json")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function aggregateConfigs() {
  console.log("Aggregating OpenTelemetry configurations with instrumentation mapping...");
  const jsonFiles = findJsonFiles(INSTRUMENTATIONS_DIR);
  const allConfigs = new Map();
  let hasErrors = false;

  jsonFiles.forEach((filePath) => {
    try {
      const pathParts = filePath.split(path.sep);
      const instrumentationName = pathParts[pathParts.length - 2];

      const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));

      if (fileData.configurations && Array.isArray(fileData.configurations)) {
        fileData.configurations.forEach((config) => {
          if (config.name) {
            if (!allConfigs.has(config.name)) {
              allConfigs.set(config.name, {
                ...config,
                instrumentations: [instrumentationName],
              });
            } else {
              const existing = allConfigs.get(config.name);

              const fieldsToMerge = [
                "declarative_name",
                "description",
                "default",
                "type",
                "example",
              ];
              fieldsToMerge.forEach((field) => {
                if (!existing[field] && config[field]) {
                  existing[field] = config[field];
                }
              });

              if (!existing.instrumentations.includes(instrumentationName)) {
                existing.instrumentations.push(instrumentationName);
              }
            }
          }
        });
      }
    } catch (err) {
      console.error(`Error parsing ${filePath}:`, err);
      hasErrors = true;
    }
  });

  if (hasErrors) {
    console.error("Aggregation failed due to parsing errors. Halting build.");
    process.exit(1);
  }

  const finalArray = Array.from(allConfigs.values()).sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalArray, null, 2));
  console.log(
    `Successfully aggregated ${finalArray.length} configurations into global-configurations.json`
  );
}

aggregateConfigs();
