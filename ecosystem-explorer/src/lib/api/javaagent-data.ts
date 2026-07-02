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
  InstrumentationIndex,
  InstrumentationListEntry,
  VersionManifest,
  VersionsIndex,
  Configuration,
} from "@/types/javaagent";
import { STORES, pruneOldEntries } from "./idb-cache";
import { fetchWithCache, resolveDataPath } from "./fetch-with-cache";
import { mapWithConcurrency } from "@/lib/map-with-concurrency";

const BASE_DIR = "data/javaagent";

// Cap on concurrent instrumentation fetches in the loadAllInstrumentations
// fan-out FALLBACK. The primary path now loads a single consolidated per-version
// bundle (see loadInstrumentationBundle); this fan-out only runs for old cached
// indexes without a bundle hash, missing bundles, or bundle errors. A version
// manifest lists ~250 instrumentations, so an unbounded fan-out would queue that
// many requests at once on a cold cache. 8 keeps a small buffer over the
// browser's ~6-per-host HTTP/1.1 connection cap without flooding IndexedDB.
const MAX_INSTRUMENTATION_FETCH_CONCURRENCY = 8;

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
        d !== null &&
        typeof d === "object" &&
        typeof d.version === "string" &&
        d.version === version &&
        d.instrumentations !== null &&
        typeof d.instrumentations === "object",
    }
  );
  if (!data) throw new Error(`Manifest for version ${version} returned null unexpectedly`);
  return data;
}

/** Loads the slim, search-oriented `index.json` in one request (mirrors the collector index path). */
export async function loadIndex(): Promise<InstrumentationIndex> {
  const data = await fetchWithCache<InstrumentationIndex>(
    "javaagent-instrumentation-index",
    resolveDataPath(BASE_DIR, "index.json"),
    STORES.METADATA
  );
  if (!data) throw new Error("Java Agent instrumentation index returned null unexpectedly");
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

/**
 * Loads the consolidated per-version list bundle in a single request. The bundle
 * is the slim shape the list page reads (telemetry collapsed to
 * has_spans/has_metrics flags); detail pages still load full per-instrumentation
 * files on demand. The bundle is content-addressed (hash in the URL and cache
 * key), so it is immutable — a rebuilt bundle is a fresh cache key.
 */
export async function loadInstrumentationBundle(
  version: string,
  bundleHash: string
): Promise<InstrumentationListEntry[]> {
  const data = await fetchWithCache<InstrumentationListEntry[]>(
    `bundle-${version}-${bundleHash}`,
    resolveDataPath(BASE_DIR, "bundles", `${version}-${bundleHash}.json`),
    STORES.INSTRUMENTATIONS,
    { validate: (d) => Array.isArray(d) && d.length > 0 }
  );
  if (!data) throw new Error(`Instrumentation bundle for ${version} returned null unexpectedly`);
  return data;
}

/**
 * Projects full detail down to the slim list shape (matches `make_list_instrumentation`),
 * so the fan-out fallback returns the same shape as the precomputed bundle.
 */
function toListEntry(instr: InstrumentationData): InstrumentationListEntry {
  return {
    name: instr.name,
    scope: instr.scope,
    display_name: instr.display_name,
    description: instr.description,
    has_javaagent: instr.has_javaagent,
    has_standalone_library: instr.has_standalone_library,
    semantic_conventions: instr.semantic_conventions,
    features: instr.features,
    configurations: instr.configurations,
    disabled_by_default: instr.disabled_by_default,
    has_spans: instr.telemetry?.some((t) => (t.spans?.length ?? 0) > 0) ?? false,
    has_metrics: instr.telemetry?.some((t) => (t.metrics?.length ?? 0) > 0) ?? false,
    _is_custom: instr._is_custom ?? false,
  };
}

export async function loadAllInstrumentations(
  version: string
): Promise<InstrumentationListEntry[]> {
  // Primary path: one request for the whole version via the consolidated bundle,
  // when the versions index advertises a bundle hash. Falls back to the
  // per-instrumentation fan-out for old cached indexes (no bundle hash), a
  // missing bundle (CDN propagation skew), or any bundle load error.
  try {
    const { versions } = await loadVersions();
    const bundleHash = versions.find((v) => v.version === version)?.bundle_hash;
    if (bundleHash) {
      return await loadInstrumentationBundle(version, bundleHash);
    }
  } catch (error) {
    console.warn("Instrumentation bundle load failed, falling back to fan-out", { version, error });
  }

  const manifest = await loadVersionManifest(version);
  const libraryIds = Object.keys(manifest.instrumentations || {});
  const customIds = Object.keys(manifest.custom_instrumentations || {});

  const allIds = [...libraryIds, ...customIds];

  // Bounded fan-out: one fetch per instrumentation, but at most
  // MAX_INSTRUMENTATION_FETCH_CONCURRENCY in flight at a time. Order is
  // preserved. Projected to the slim list shape so the return type matches the
  // bundle path (mirrors collector's loadAllComponents).
  const entries = await mapWithConcurrency(allIds, MAX_INSTRUMENTATION_FETCH_CONCURRENCY, (id) =>
    loadInstrumentation(id, version, manifest)
  );
  return entries.map(toListEntry);
}

export async function loadAllInstrumentationDetails(
  version: string
): Promise<InstrumentationData[]> {
  const manifest = await loadVersionManifest(version);
  const libraryIds = Object.keys(manifest.instrumentations || {});
  const customIds = Object.keys(manifest.custom_instrumentations || {});

  const allIds = [...libraryIds, ...customIds];

  const entries = await mapWithConcurrency(allIds, MAX_INSTRUMENTATION_FETCH_CONCURRENCY, (id) =>
    loadInstrumentation(id, version, manifest)
  );
  return entries;
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
    STORES.GLOBAL_CONFIGURATIONS,
    { validate: (d) => Array.isArray(d) }
  );
  if (!data) throw new Error("Global configurations returned null unexpectedly");
  return data;
}
