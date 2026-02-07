import type { InstrumentationData, VersionManifest, VersionsIndex } from "@/types/javaagent";
import { getCached, setCached, STORES } from "./idb-cache";

const BASE_PATH = "/data/javaagent";

const inflightRequests = new Map<string, Promise<unknown>>();

const idbEnabled = true;

async function fetchWithCache<T>(
  cacheKey: string,
  url: string,
  storeType: "metadata" | "instrumentations" = STORES.INSTRUMENTATIONS
): Promise<T> {
  // Check if request is already in flight
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey) as Promise<T>;
  }

  const request = (async () => {
    try {
      if (idbEnabled) {
        const cachedData = await getCached<T>(cacheKey, storeType);
        if (cachedData !== null) {
          inflightRequests.delete(cacheKey);
          return cachedData;
        }
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${cacheKey}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (idbEnabled) {
        await setCached(cacheKey, data, storeType);
      }

      inflightRequests.delete(cacheKey);
      return data;
    } catch (error) {
      inflightRequests.delete(cacheKey);
      throw error;
    }
  })();

  inflightRequests.set(cacheKey, request);
  return request;
}

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
  version: string
): Promise<InstrumentationData> {
  const manifest = await loadVersionManifest(version);
  const hash = manifest.instrumentations[id];

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

  console.log(`Loading ${instrumentationIds.length} instrumentations for version ${version}`);

  return await Promise.all(
    instrumentationIds.map(async (id) => {
      return loadInstrumentation(id, version);
    })
  );
}
