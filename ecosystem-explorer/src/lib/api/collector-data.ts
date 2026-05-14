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
import type { CollectorComponent, VersionManifest, VersionsIndex } from "@/types/collector";
import { STORES } from "./idb-cache";
import { fetchWithCache } from "./fetch-with-cache";

const BASE_PATH = "/data/collector";

export async function loadVersions(): Promise<VersionsIndex> {
  const data = await fetchWithCache<VersionsIndex>(
    "collector-versions-index",
    `${BASE_PATH}/versions-index.json`,
    STORES.METADATA
  );
  if (!data) throw new Error("Collector versions index returned null unexpectedly");
  return data;
}

export async function loadVersionManifest(version: string): Promise<VersionManifest> {
  const data = await fetchWithCache<VersionManifest>(
    `collector-manifest-${version}`,
    `${BASE_PATH}/versions/${version}-index.json`,
    STORES.METADATA
  );
  if (!data)
    throw new Error(`Collector manifest for version ${version} returned null unexpectedly`);
  return data;
}

export async function loadComponent(
  distribution: string,
  name: string,
  version: string,
  manifest?: VersionManifest
): Promise<CollectorComponent> {
  const id = `${distribution}-${name}`;
  const resolvedManifest = manifest ?? (await loadVersionManifest(version));
  const hash = resolvedManifest.components[id];

  if (!hash) {
    throw new Error(`Collector component "${id}" not found in version ${version}`);
  }

  const filename = `${id}-${hash}.json`;
  const data = await fetchWithCache<CollectorComponent>(
    `collector-component-${hash}`,
    `${BASE_PATH}/components/${id}/${filename}`,
    STORES.INSTRUMENTATIONS
  );
  if (!data) throw new Error(`Collector component "${id}" returned null unexpectedly`);
  return data;
}

export async function loadAllComponents(version: string): Promise<CollectorComponent[]> {
  const manifest = await loadVersionManifest(version);
  const componentIds = Object.keys(manifest.components);

  return Promise.all(
    componentIds.map(async (id) => {
      // Parse id from format "distribution-name"
      const parts = id.split("-");
      const distribution = parts[0]; // "contrib" or "core"
      const name = parts.slice(1).join("-"); // Everything after first dash
      return loadComponent(distribution, name, version, manifest);
    })
  );
}
