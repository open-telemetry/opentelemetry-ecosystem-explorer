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
import type { JavascriptIndex, JavascriptPackage } from "@/types/javascript";
import { STORES } from "./idb-cache";
import { fetchWithCache, resolveDataPath } from "./fetch-with-cache";

const BASE_DIR = "data/javascript";

/**
 * Loads `index.json`: every package, its latest metadata and its releases.
 *
 * It is the only manifest for this ecosystem (there is no versions index), so a
 * response without a packages list is rejected rather than cached.
 */
export async function loadIndex(): Promise<JavascriptIndex> {
  const data = await fetchWithCache<JavascriptIndex>(
    "javascript-index",
    resolveDataPath(BASE_DIR, "index.json"),
    STORES.METADATA,
    { validate: (d) => d !== null && typeof d === "object" && Array.isArray(d.packages) }
  );
  if (!data) throw new Error("JavaScript index returned null unexpectedly");
  return data;
}

/**
 * Loads one release of a package, or its latest release when `version` is omitted.
 *
 * The release is resolved through `index.json` to its content-addressed package
 * file. Package files are immutable, so they are cached without expiry. `name` and
 * `version` usually come from the URL, so both go through path validation before
 * any fetch.
 *
 * @param index Optional pre-loaded index, so a page that already holds it does not
 *   look it up again.
 */
export async function loadPackage(
  name: string,
  version?: string,
  index?: JavascriptIndex
): Promise<JavascriptPackage> {
  const resolvedIndex = index ?? (await loadIndex());
  const entry = resolvedIndex.packages.find((p) => p.name === name);
  if (!entry) {
    throw new Error(`JavaScript package "${name}" not found`);
  }

  const release = version ? entry.releases.find((r) => r.version === version) : entry.releases[0];
  if (!release) {
    throw new Error(`JavaScript package "${name}" has no release ${version}`);
  }

  const data = await fetchWithCache<JavascriptPackage>(
    `javascript-package-${name}-${release.hash}`,
    resolveDataPath(BASE_DIR, "packages", name, `${name}-${release.hash}.json`),
    STORES.INSTRUMENTATIONS,
    { immutable: true, validate: (d) => d !== null && typeof d === "object" && d.name === name }
  );
  if (!data) throw new Error(`JavaScript package "${name}" returned null unexpectedly`);
  return data;
}
