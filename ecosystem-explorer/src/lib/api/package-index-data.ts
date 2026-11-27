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

import { STORES } from "./idb-cache";
import { fetchWithCache, resolveDataPath } from "./fetch-with-cache";

/** One release of a package and the content-addressed package file it uses. */
export interface PackageRelease {
  version: string;
  hash: string;
}

/** The part of an index entry the loader needs; ecosystems add their own fields. */
export interface PackageIndexEntry {
  name: string;
  releases: PackageRelease[];
}

export interface PackageIndexShape<TEntry extends PackageIndexEntry> {
  packages: TEntry[];
}

export interface PackageIndexLoaders<TIndex, TPackage> {
  loadIndex: () => Promise<TIndex>;
  loadPackage: (name: string, version?: string, index?: TIndex) => Promise<TPackage>;
}

/**
 * Builds the loaders for an ecosystem whose database is one `index.json` plus
 * content-addressed package files (`packages/{name}/{name}-{hash}.json`), as written by
 * explorer-db-builder's package-index pipeline (javascript, python).
 *
 * @param ecosystem Directory under `data/` and cache-key prefix, e.g. "python".
 * @param label Human-readable name used in error messages, e.g. "Python".
 */
export function createPackageIndexLoaders<
  TIndex extends PackageIndexShape<PackageIndexEntry>,
  TPackage extends { name: string },
>(ecosystem: string, label: string): PackageIndexLoaders<TIndex, TPackage> {
  const baseDir = `data/${ecosystem}`;

  /**
   * Loads `index.json`: every package, its latest metadata and its releases.
   *
   * It is the only manifest for the ecosystem (there is no versions index), so a
   * response without a packages list is rejected rather than cached.
   */
  async function loadIndex(): Promise<TIndex> {
    const data = await fetchWithCache<TIndex>(
      `${ecosystem}-index`,
      resolveDataPath(baseDir, "index.json"),
      STORES.METADATA,
      { validate: (d) => d !== null && typeof d === "object" && Array.isArray(d.packages) }
    );
    if (!data) throw new Error(`${label} index returned null unexpectedly`);
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
  async function loadPackage(name: string, version?: string, index?: TIndex): Promise<TPackage> {
    const resolvedIndex = index ?? (await loadIndex());
    const entry = resolvedIndex.packages.find((p) => p.name === name);
    if (!entry) {
      throw new Error(`${label} package "${name}" not found`);
    }

    const release = version ? entry.releases.find((r) => r.version === version) : entry.releases[0];
    if (!release) {
      throw new Error(`${label} package "${name}" has no release ${version}`);
    }

    const data = await fetchWithCache<TPackage>(
      `${ecosystem}-package-${name}-${release.hash}`,
      resolveDataPath(baseDir, "packages", name, `${name}-${release.hash}.json`),
      STORES.INSTRUMENTATIONS,
      { immutable: true, validate: (d) => d !== null && typeof d === "object" && d.name === name }
    );
    if (!data) throw new Error(`${label} package "${name}" returned null unexpectedly`);
    return data;
  }

  return { loadIndex, loadPackage };
}
