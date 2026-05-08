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
import type { PrometheusComponent, PrometheusVersionsIndex } from "@/types/prometheus";
import { STORES } from "./idb-cache";
import { fetchWithCache } from "./fetch-with-cache";

const BASE_PATH = "/data/prometheus";

export async function loadVersions(): Promise<PrometheusVersionsIndex> {
  const data = await fetchWithCache<PrometheusVersionsIndex>(
    "prometheus-versions-index",
    `${BASE_PATH}/versions-index.json`,
    STORES.METADATA
  );
  if (!data) throw new Error("Prometheus versions index returned null unexpectedly");
  return data;
}

export async function loadComponent(id: string, version: string): Promise<PrometheusComponent> {
  // We need to find the hash for this component from the version index
  const versionIndex = await fetchWithCache<{
    version: string;
    components: Record<string, string>;
  }>(
    `prometheus-manifest-${version}`,
    `${BASE_PATH}/versions/${version}-index.json`,
    STORES.METADATA
  );

  if (!versionIndex) {
    throw new Error(`Prometheus manifest for version ${version} returned null unexpectedly`);
  }

  const hash = versionIndex.components[id];
  if (!hash) {
    throw new Error(`Prometheus component "${id}" not found in version ${version}`);
  }

  const filename = `${id}-${hash}.json`;
  const data = await fetchWithCache<PrometheusComponent>(
    `prometheus-component-${hash}`,
    `${BASE_PATH}/components/${id}/${filename}`,
    STORES.INSTRUMENTATIONS
  );
  if (!data) throw new Error(`Prometheus component "${id}" returned null unexpectedly`);
  return data;
}

export async function loadAllComponents(version: string): Promise<PrometheusComponent[]> {
  const versionIndex = await fetchWithCache<{
    version: string;
    components: Record<string, string>;
  }>(
    `prometheus-manifest-${version}`,
    `${BASE_PATH}/versions/${version}-index.json`,
    STORES.METADATA
  );

  if (!versionIndex) {
    throw new Error(`Prometheus manifest for version ${version} returned null unexpectedly`);
  }

  const componentIds = Object.keys(versionIndex.components);

  return Promise.all(
    componentIds.map(async (id) => {
      const hash = versionIndex.components[id];
      const filename = `${id}-${hash}.json`;
      const data = await fetchWithCache<PrometheusComponent>(
        `prometheus-component-${hash}`,
        `${BASE_PATH}/components/${id}/${filename}`,
        STORES.INSTRUMENTATIONS
      );
      if (!data) throw new Error(`Prometheus component "${id}" returned null unexpectedly`);
      return data;
    })
  );
}
