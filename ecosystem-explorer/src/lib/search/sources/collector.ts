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

import { loadIndex, loadVersions as loadCollectorVersions } from "@/lib/api/collector-data";
import type { CollectorComponent, IndexComponent } from "@/types/collector";
import type { SearchResult, SearchSource } from "../types";

/** Maps a Collector index component to a search result. Exported for unit tests. */
export function toCollectorResult(
  component: IndexComponent,
  version: string,
  resultType: SearchResult["type"] = "item"
): SearchResult {
  return {
    title: component.display_name ?? component.name,
    description: component.description ?? "OpenTelemetry Collector component",
    path: `/collector/components/${component.distribution}/${component.name}?version=${version}`,
    type: resultType,
    keywords: [component.id, component.name, component.distribution, component.type].filter(
      (value): value is string => Boolean(value)
    ),
    ecosystem: "collector",
    // Component type is the Collector's meta-line facet. IndexComponent.type is
    // `string` for forward-compat; the cast narrows to the CollectorComponent
    // union. Safe because the generated index emits values from that union.
    facets: [component.type as CollectorComponent["type"]],
    stability: component.stability ?? undefined,
    version,
  };
}

async function loadCollectorSearchResults(): Promise<SearchResult[]> {
  // One fetch for /data/collector/index.json + one for versions-index.json,
  // instead of fanning out to one fetch per component. The index already
  // carries name/distribution/type/display_name/description/stability — all
  // SearchResult needs. Per-component JSONs are loaded lazily by the
  // detail page on click.
  const [versionsIndex, index] = await Promise.all([loadCollectorVersions(), loadIndex()]);
  const latestVersion = versionsIndex.versions.find((version) => version.is_latest)?.version;
  if (!latestVersion) return [];

  return index.components.map((component) => toCollectorResult(component, latestVersion));
}

export const collectorSearchSource: SearchSource = {
  id: "collector",
  load: loadCollectorSearchResults,
};
