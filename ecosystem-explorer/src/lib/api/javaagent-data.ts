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
  return fetchWithCache<VersionsIndex>(
    "versions-index",
    `${BASE_PATH}/versions-index.json`,
    STORES.METADATA
  );
}

export async function loadVersionManifest(version: string): Promise<VersionManifest> {
  return fetchWithCache<VersionManifest>(
    `manifest-${version}`,
    `${BASE_PATH}/versions/${version}-index.json`,
    STORES.METADATA
  );
}

export async function loadInstrumentation(
  id: string,
  version: string,
  manifest?: VersionManifest
): Promise<InstrumentationData> {
  const resolvedManifest = manifest ?? (await loadVersionManifest(version));
  const hash = resolvedManifest.instrumentations[id];

  if (!hash) {
    throw new Error(`Instrumentation "${id}" not found in version ${version}`);
  }

  const filename = `${id}-${hash}.json`;
  return fetchWithCache<InstrumentationData>(
    `instrumentation-${hash}`,
    `${BASE_PATH}/instrumentations/${id}/${filename}`,
    STORES.INSTRUMENTATIONS
  );
}

export async function loadAllInstrumentations(version: string): Promise<InstrumentationData[]> {
  const manifest = await loadVersionManifest(version);
  const instrumentationIds = Object.keys(manifest.instrumentations);

  return Promise.all(
    instrumentationIds.map(async (id) => {
      return loadInstrumentation(id, version, manifest);
    })
  );
}
