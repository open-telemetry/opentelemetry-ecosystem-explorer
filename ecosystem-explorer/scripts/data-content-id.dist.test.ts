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
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const explorer = path.resolve(import.meta.dirname, "..");

describe("built bundle", () => {
  it("embeds the id content-digest.sh computes for public/data in the cache's chunk", () => {
    const script = path.resolve(explorer, "..", ".github", "scripts", "content-digest.sh");
    const expected = execFileSync("bash", [script, path.join(explorer, "public", "data")], {
      encoding: "utf8",
    }).trim();
    const assets = path.join(explorer, "dist", "assets");
    const cacheChunks = readdirSync(assets)
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFileSync(path.join(assets, name), "utf8"))
      .filter((source) => source.includes("otel-explorer-cache"));

    expect(expected).toMatch(/^[0-9a-f]{64}$/);
    expect(cacheChunks.length).toBeGreaterThan(0);
    for (const chunk of cacheChunks) expect(chunk).toContain(expected);
  });
});
