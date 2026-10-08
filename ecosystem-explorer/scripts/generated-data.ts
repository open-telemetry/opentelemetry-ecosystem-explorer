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
import { statSync } from "node:fs";
import { resolve } from "node:path";

const SENTINELS = [
  "javaagent/versions-index.json",
  "collector/versions-index.json",
  "configuration/versions-index.json",
  "javascript/index.json",
];

export function missingGeneratedData(dataDir: string): string[] {
  return SENTINELS.filter(
    (relative) => !statSync(resolve(dataDir, relative), { throwIfNoEntry: false })?.isFile()
  );
}

export function missingGeneratedDataMessage(missing: string[]): string {
  return (
    `The generated explorer database is missing: ${missing.join(", ")}.\n` +
    `From the repository root:  uv run explorer-db-builder --clean`
  );
}
