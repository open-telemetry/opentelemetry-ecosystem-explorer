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
  ComponentType,
  ContribEntry,
  ContribStability,
  DistributionName,
} from "@/types/java-contrib";

export interface ContribFilters {
  query: string;
  types: ComponentType[];
  stabilities: ContribStability[];
  /** Keeps components whose minimum is at or below this runtime version. */
  javaVersion: number | null;
  /** Keeps components bundled in this distribution. */
  distribution: DistributionName | null;
}

export const EMPTY_FILTERS: ContribFilters = {
  query: "",
  types: [],
  stabilities: [],
  javaVersion: null,
  distribution: null,
};

export function filterContribEntries(
  entries: ContribEntry[],
  filters: ContribFilters
): ContribEntry[] {
  const { query, types, stabilities, javaVersion, distribution } = filters;
  const q = query.trim().toLowerCase();
  return entries.filter(({ id, component }) => {
    if (
      q &&
      ![id, component.display_name, component.description, component.artifact?.artifact_id ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    if (types.length > 0 && !types.some((type) => component.component_types.includes(type))) {
      return false;
    }
    if (stabilities.length > 0 && !stabilities.includes(component.status.stability)) {
      return false;
    }
    if (javaVersion !== null && component.min_java_version > javaVersion) {
      return false;
    }
    if (distribution !== null && !component.distributions.some((d) => d.name === distribution)) {
      return false;
    }
    return true;
  });
}
