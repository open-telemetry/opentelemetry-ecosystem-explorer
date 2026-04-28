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
import type { InstrumentationData, VersionManifest, VersionsIndex } from "@/types/javaagent";
import { STORES } from "./idb-cache";
import { fetchWithCache } from "./fetch-with-cache";

const BASE_PATH = "/data/javaagent";

export async function loadVersions(): Promise<VersionsIndex> {
  const data = await fetchWithCache<VersionsIndex>(
    "versions-index",
    `${BASE_PATH}/versions-index.json`,
    STORES.METADATA
  );
  if (!data) throw new Error("Versions index returned null unexpectedly");
  return data;
}

export async function loadVersionManifest(version: string): Promise<VersionManifest> {
  const data = await fetchWithCache<VersionManifest>(
    `manifest-${version}`,
    `${BASE_PATH}/versions/${version}-index.json`,
    STORES.METADATA
  );
  if (!data) throw new Error(`Manifest for version ${version} returned null unexpectedly`);
  return data;
}

export async function loadInstrumentation(
  id: string,
  version: string,
  manifest?: VersionManifest
): Promise<InstrumentationData> {
  const resolvedManifest = manifest ?? (await loadVersionManifest(version));

  const libraryHash = resolvedManifest.instrumentations[id];
  const customHash = resolvedManifest.custom_instrumentations?.[id];
  const hash = libraryHash || customHash;
  const isCustom = !!customHash;

  if (!hash) {
    throw new Error(`Instrumentation "${id}" not found in version ${version}`);
  }

  const filename = `${id}-${hash}.json`;
  const data = await fetchWithCache<InstrumentationData>(
    `instrumentation-${hash}`,
    `${BASE_PATH}/instrumentations/${id}/${filename}`,
    STORES.INSTRUMENTATIONS
  );
  if (!data) throw new Error(`Instrumentation "${id}" returned null unexpectedly`);

  return { ...data, _is_custom: isCustom };
}

export async function loadAllInstrumentations(version: string): Promise<InstrumentationData[]> {
  const manifest = await loadVersionManifest(version);
  const libraryIds = Object.keys(manifest.instrumentations || {});
  const customIds = Object.keys(manifest.custom_instrumentations || {});

  const allIds = [...libraryIds, ...customIds];

  return Promise.all(
    allIds.map(async (id) => {
      return loadInstrumentation(id, version, manifest);
    })
  );
}
