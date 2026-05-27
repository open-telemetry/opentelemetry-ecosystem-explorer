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

import * as TJS from "typescript-json-schema";
import * as path from "path";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const settings = {
  required: true,
  ref: false,
  topRef: false,
  noExtraProps: false,
  propOrder: true,
  validationKeywords: [],
  include: [],
  excludePrivate: true,
  uniqueNames: true,
  strictNullChecks: true,
};

const compilerOptions = {
  strictNullChecks: true,
  esModuleInterop: true,
  skipLibCheck: true,
  target: "ESNext",
  module: "ESNext",
  moduleResolution: "node",
};

async function generateSchema(filePath, typeName, outputName) {
  console.log(`Generating schema for ${typeName} from ${path.basename(filePath)}...`);

  const program = TJS.getProgramFromFiles([path.resolve(ROOT_DIR, filePath)], compilerOptions);
  const schema = TJS.generateSchema(program, typeName, settings);

  if (!schema) {
    throw new Error(`Failed to generate schema for ${typeName}`);
  }

  // Add standard header
  schema.$schema = "https://json-schema.org/draft-07/schema#";

  const outputPath = path.resolve(ROOT_DIR, "public/schemas", outputName);
  await fs.writeFile(outputPath, JSON.stringify(schema, null, 2), "utf-8");
  console.log(` - Saved to ${path.relative(ROOT_DIR, outputPath)}`);
}

async function main() {
  try {
    await fs.mkdir(path.resolve(ROOT_DIR, "public/schemas"), { recursive: true });

    await generateSchema(
      "src/types/collector.ts",
      "CollectorComponent",
      "collector-component.schema.json"
    );

    await generateSchema(
      "src/types/javaagent.ts",
      "InstrumentationData",
      "javaagent-instrumentation.schema.json"
    );

    console.log("\n✓ JSON Schemas generated successfully.");
  } catch (err) {
    console.error("❌ Schema generation failed:", err);
    process.exit(1);
  }
}

main();
