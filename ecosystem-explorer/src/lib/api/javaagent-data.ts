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
import type {
  InstrumentationData,
  VersionManifest,
  VersionsIndex,
  Configuration,
} from "@/types/javaagent";
import { STORES, pruneOldEntries } from "./idb-cache";
import { fetchWithCache, resolveDataPath } from "./fetch-with-cache";

const BASE_DIR = "data/javaagent";

export interface GlobalConfiguration extends Configuration {
  instrumentations?: string[];
}

export async function loadVersions(): Promise<VersionsIndex> {
  const data = await fetchWithCache<VersionsIndex>(
    "versions-index",
    resolveDataPath(BASE_DIR, "versions-index.json"),
    STORES.METADATA,
    { validate: (d) => Array.isArray(d.versions) && d.versions.length > 0 }
  );
  if (!data) throw new Error("Versions index returned null unexpectedly");

  // Trigger background cache pruning. The guard inside pruneOldEntries ensures
  // this runs at most once every 24 hours regardless of how often loadVersions is called.
  pruneOldEntries().catch(() => {});

  return data;
}

export async function loadVersionManifest(version: string): Promise<VersionManifest> {
  const data = await fetchWithCache<VersionManifest>(
    `manifest-${version}`,
    resolveDataPath(BASE_DIR, "versions", `${version}-index.json`),
    STORES.METADATA,
    {
      validate: (d) =>
        typeof d.version === "string" &&
        d.version === version &&
        d.instrumentations !== null &&
        typeof d.instrumentations === "object",
    }
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
    resolveDataPath(BASE_DIR, "instrumentations", id, filename),
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

export async function loadLibraryReadme(
  libraryName: string,
  markdownHash: string
): Promise<string> {
  const baseUrl = import.meta.env.BASE_URL || "";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const url = `${normalizedBase}/${BASE_DIR}/markdown/${libraryName}-${markdownHash}.md`;
  const data = await fetchWithCache<string>(
    `readme-${libraryName}-${markdownHash}`,
    url,
    STORES.METADATA,
    { format: "text" }
  );
  if (data === null) {
    throw new Error(`README for ${libraryName} returned null unexpectedly`);
  }
  return data;
}

export async function loadGlobalConfigurations(): Promise<GlobalConfiguration[]> {
  const data = await fetchWithCache<GlobalConfiguration[]>(
    "global-configurations",
    resolveDataPath(BASE_DIR, "global-configurations.json"),
    STORES.GLOBAL_CONFIGURATIONS
  );
  if (!data) throw new Error("Global configurations returned null unexpectedly");
  return data;
}
