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
  CollectorComponent,
  CollectorIndex,
  IndexComponent,
  Stability,
  VersionManifest,
  VersionsIndex,
} from "@/types/collector";
import { STORES } from "./idb-cache";
import { fetchWithCache } from "./fetch-with-cache";
import { mapWithConcurrency } from "@/lib/map-with-concurrency";

const BASE_PATH = "/data/collector";

// Cap on concurrent component fetches in the loadAllComponents fan-out FALLBACK.
// The primary path now loads a single consolidated per-version bundle (see
// loadComponentBundle); this fan-out only runs for old cached indexes without a
// bundle hash, missing bundles, or bundle errors. A version manifest lists ~265
// components, so an unbounded fan-out would queue that many requests at once on
// a cold cache. 8 keeps a small buffer over the browser's ~6-per-host HTTP/1.1
// connection cap without flooding the IndexedDB cache layer.
const MAX_COMPONENT_FETCH_CONCURRENCY = 8;

// Mirrors _STABILITY_RANK in collector_transformer.py so the fan-out fallback
// derives the same primary stability the bundle (make_index_component) carries.
const STABILITY_RANK: Record<string, number> = { stable: 3, beta: 2, alpha: 1, development: 0 };

// Mirrors _SIGNAL_ORDER in collector_transformer.py so the fan-out fallback derives
// signals in the same order as the bundle (make_index_component).
const SIGNAL_ORDER = ["traces", "metrics", "logs", "profiles"];

function deriveStability(stability?: Partial<Record<Stability, string[]>>): Stability | null {
  const levels = stability ? Object.keys(stability) : [];
  if (levels.length === 0) return null;
  return levels.reduce((best, lvl) =>
    (STABILITY_RANK[lvl] ?? -1) > (STABILITY_RANK[best] ?? -1) ? lvl : best
  ) as Stability;
}

// Mirrors _derive_signals in collector_transformer.py: dedupes signal names across
// all stability levels, known signals first in canonical order, then any
// unrecognized signal names sorted alphabetically.
function deriveSignals(stability?: Partial<Record<Stability, string[]>>): string[] {
  const signals = new Set(Object.values(stability ?? {}).flat());
  const known = SIGNAL_ORDER.filter((s) => signals.has(s));
  const unknown = [...signals].filter((s) => !SIGNAL_ORDER.includes(s)).sort();
  return [...known, ...unknown];
}

/** Projects a full component down to the slim list shape (matches make_index_component). */
function toIndexComponent(component: CollectorComponent): IndexComponent {
  return {
    id: component.id,
    name: component.name,
    distribution: component.distribution,
    type: component.type,
    display_name: component.display_name,
    description: component.description,
    stability: deriveStability(component.status?.stability),
    signals: deriveSignals(component.status?.stability),
  };
}

export async function loadVersions(): Promise<VersionsIndex> {
  const data = await fetchWithCache<VersionsIndex>(
    "collector-versions-index",
    `${BASE_PATH}/versions-index.json`,
    STORES.METADATA,
    {
      validate: (d) =>
        d !== null && typeof d === "object" && Array.isArray(d.versions) && d.versions.length > 0,
    }
  );
  if (!data) throw new Error("Collector versions index returned null unexpectedly");
  return data;
}

export async function loadIndex(): Promise<CollectorIndex> {
  const data = await fetchWithCache<CollectorIndex>(
    "collector-component-index",
    `${BASE_PATH}/index.json`,
    STORES.METADATA
  );
  if (!data) throw new Error("Collector component index returned null unexpectedly");
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

/**
 * Loads the consolidated per-version list bundle in a single request. Entries
 * are the slim IndexComponent shape (the fields the list page reads, stability
 * pre-derived); detail pages still load full per-component files on demand. The
 * bundle is content-addressed (hash in the URL and cache key), so it is
 * immutable — a rebuilt bundle is a fresh cache key.
 */
export async function loadComponentBundle(
  version: string,
  bundleHash: string
): Promise<IndexComponent[]> {
  const data = await fetchWithCache<IndexComponent[]>(
    `collector-bundle-${version}-${bundleHash}`,
    `${BASE_PATH}/bundles/${version}-${bundleHash}.json`,
    STORES.INSTRUMENTATIONS,
    { validate: (d) => Array.isArray(d) && d.length > 0 }
  );
  if (!data) throw new Error(`Collector bundle for ${version} returned null unexpectedly`);
  return data;
}

export async function loadAllComponents(version: string): Promise<IndexComponent[]> {
  // Primary path: one request for the whole version via the consolidated bundle,
  // when the versions index advertises a bundle hash. Falls back to the
  // per-component fan-out for old cached indexes (no bundle hash), a missing
  // bundle (CDN propagation skew), or any bundle load error.
  try {
    const { versions } = await loadVersions();
    const bundleHash = versions.find((v) => v.version === version)?.bundle_hash;
    if (bundleHash) {
      return await loadComponentBundle(version, bundleHash);
    }
  } catch (error) {
    console.warn("Collector bundle load failed, falling back to fan-out", { version, error });
  }

  const manifest = await loadVersionManifest(version);
  const componentIds = Object.keys(manifest.components);

  // Bounded fan-out: one fetch per component, but at most
  // MAX_COMPONENT_FETCH_CONCURRENCY in flight at a time. Order is preserved, so
  // callers see the same result as the prior Promise.all. Projected to the slim
  // IndexComponent shape so the return type matches the bundle path.
  const components = await mapWithConcurrency(
    componentIds,
    MAX_COMPONENT_FETCH_CONCURRENCY,
    (id) => {
      // Parse id from format "distribution-name"
      const parts = id.split("-");
      const distribution = parts[0]; // "contrib" or "core"
      const name = parts.slice(1).join("-"); // Everything after first dash
      return loadComponent(distribution, name, version, manifest);
    }
  );
  return components.map(toIndexComponent);
}
