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
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { missingGeneratedData, missingGeneratedDataMessage } from "./generated-data.ts";

function regularFiles(dataDir: string, relative = ""): string[] {
  return readdirSync(path.join(dataDir, relative), { withFileTypes: true }).flatMap((entry) => {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return regularFiles(dataDir, child);
    return entry.isFile() ? [child] : [];
  });
}

export function dataContentId(dataDir: string): string {
  const files = (existsSync(dataDir) ? regularFiles(dataDir) : []).sort((a, b) =>
    Buffer.compare(Buffer.from(a), Buffer.from(b))
  );
  const digest = createHash("sha256");
  for (const file of files) {
    if (/[\n\r\\]/.test(file)) {
      throw new Error(`${JSON.stringify(file)} cannot round-trip through sha256sum`);
    }
    const fileHash = createHash("sha256")
      .update(readFileSync(path.join(dataDir, file)))
      .digest("hex");
    digest.update(`${fileHash}  ${file}\n`);
  }
  return digest.digest("hex");
}

export function dataContentIdPlugin(dataDir: string): Plugin {
  return {
    name: "data-content-id",
    config(_config, { command }) {
      const missing = missingGeneratedData(dataDir);
      if (missing.length > 0) {
        if (command === "build") throw new Error(missingGeneratedDataMessage(missing));
        console.warn(missingGeneratedDataMessage(missing));
      }
      return {
        define: { "import.meta.env.DATA_CONTENT_ID": JSON.stringify(dataContentId(dataDir)) },
      };
    },
  };
}
