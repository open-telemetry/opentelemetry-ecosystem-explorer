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

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STYLES_DIR = dirname(fileURLToPath(import.meta.url));

// Chrome partials mirror opentelemetry.io's literal metrics verbatim and are
// not on the scale; tokens.css declares the scale itself.
const EXEMPT = new Set([
  "navbar.css",
  "sub-nav.css",
  "footer.css",
  "cncf-callout.css",
  "language-toggle.css",
  "theme-toggle.css",
  "buttons.css",
  "tokens.css",
  "index.css",
]);

describe("v1 type scale", () => {
  it("content partials size text only through --td-fs-* tokens", () => {
    const offenders: string[] = [];
    const files = readdirSync(STYLES_DIR).filter((f) => f.endsWith(".css") && !EXEMPT.has(f));
    for (const file of files) {
      const lines = readFileSync(join(STYLES_DIR, file), "utf8").split("\n");
      lines.forEach((line, index) => {
        const match = /font-size:\s*([^;]+);/.exec(line);
        if (!match) return;
        const value = match[1].trim();
        if (value.startsWith("var(--td-fs-") || value === "inherit") return;
        offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(files.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
