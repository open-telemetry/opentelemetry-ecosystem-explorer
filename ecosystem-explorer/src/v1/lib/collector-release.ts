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

import type { CollectorComponent, VersionsIndex } from "@/types/collector";

type ComponentAddress = Pick<CollectorComponent, "distribution" | "name">;
type ComponentSource = Pick<CollectorComponent, "repository" | "type" | "name">;

/** Collector release selection and links share one policy across list and detail routes. */
export function collectorReleaseContext({
  searchParams,
  pathVersion,
  versions,
}: {
  searchParams: URLSearchParams;
  pathVersion?: string;
  versions?: VersionsIndex | null;
}) {
  const selectedVersion = searchParams.get("version") || pathVersion || undefined;
  const deprecated = selectedVersion === "deprecated";
  const latestVersion = versions?.versions.find((v) => v.is_latest)?.version ?? "";
  const listParams = new URLSearchParams(searchParams);
  if (selectedVersion) listParams.set("version", selectedVersion);
  else listParams.delete("version");
  const listSearch = listParams.toString();

  return {
    deprecated,
    latestVersion,
    // Preserve all filters when replacing a historical path with its canonical query route.
    listHref: `/collector/components${listSearch ? `?${listSearch}` : ""}`,
    dataVersion(lastVersion?: string): string {
      return deprecated ? (lastVersion ?? "") : (selectedVersion ?? latestVersion);
    },
    detailHref(component: ComponentAddress, version = selectedVersion): string {
      const suffix = version ? `?version=${encodeURIComponent(version)}` : "";
      return `/collector/components/${component.distribution}/${component.name}${suffix}`;
    },
    sourceHref(component: ComponentSource, lastVersion?: string): string | null {
      if (!component.repository) return null;
      const version = deprecated ? lastVersion : selectedVersion;
      if (deprecated && !version) return null;
      // An implicit latest view follows main; an explicit release is pinned to its tag.
      const ref = version ? `v${version}` : "main";
      return `https://github.com/open-telemetry/${component.repository}/tree/${ref}/${component.type}/${component.name}`;
    },
  };
}

export type CollectorReleaseContext = ReturnType<typeof collectorReleaseContext>;
