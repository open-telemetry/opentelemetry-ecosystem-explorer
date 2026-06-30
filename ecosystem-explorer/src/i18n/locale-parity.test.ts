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
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, "../../public/locales");
const baseLng = "en";

type JsonObject = { [key: string]: unknown };

function listLanguages(): string[] {
  return readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function listNamespaces(lng: string): string[] {
  return readdirSync(resolve(localesDir, lng), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
}

function loadNamespace(lng: string, ns: string): JsonObject {
  const file = resolve(localesDir, lng, ns);
  return JSON.parse(readFileSync(file, "utf-8")) as JsonObject;
}

function flattenKeys(obj: JsonObject, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const nested of flattenKeys(value as JsonObject, path)) {
        keys.add(nested);
      }
    } else {
      keys.add(path);
    }
  }
  return keys;
}

const languages = listLanguages();

describe("locale key parity", () => {
  it(`found a "${baseLng}" locale directory to diff every other language against`, () => {
    expect(languages).toContain(baseLng);
  });

  if (!languages.includes(baseLng)) {
    return;
  }

  const baseNamespaces = listNamespaces(baseLng);

  for (const lng of languages) {
    if (lng === baseLng) continue;

    it(`${lng} has the same namespace files as ${baseLng}`, () => {
      expect(listNamespaces(lng)).toEqual(baseNamespaces);
    });

    for (const ns of baseNamespaces) {
      it(`${lng}/${ns} has the same keys as ${baseLng}/${ns}`, () => {
        const baseKeys = flattenKeys(loadNamespace(baseLng, ns));
        const lngKeys = flattenKeys(loadNamespace(lng, ns));

        const missing = [...baseKeys].filter((k) => !lngKeys.has(k)).sort();
        const extra = [...lngKeys].filter((k) => !baseKeys.has(k)).sort();

        expect(missing).toEqual([]);
        expect(extra).toEqual([]);
      });
    }
  }
});
