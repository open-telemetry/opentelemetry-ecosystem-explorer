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
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const legacyAppPath = resolve(__dirname, "LegacyApp.tsx");
const v1AppPath = resolve(__dirname, "v1/V1App.tsx");

function extractRoutePaths(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  return [...content.matchAll(/path="([^"]+)"/g)].map((match) => match[1]);
}

const legacyPaths = Array.from(new Set(extractRoutePaths(legacyAppPath)));
const v1Paths = extractRoutePaths(v1AppPath);
const v1PathSet = new Set(v1Paths);

describe("route table sync between LegacyApp and V1App", () => {
  it("extracted route paths from both LegacyApp.tsx and V1App.tsx", () => {
    expect(legacyPaths.length).toBeGreaterThan(0);
    expect(v1Paths.length).toBeGreaterThan(0);
  });

  for (const path of legacyPaths) {
    it(`LegacyApp route "${path}" also exists in V1App`, () => {
      expect(v1PathSet.has(path)).toBe(true);
    });
  }
});
