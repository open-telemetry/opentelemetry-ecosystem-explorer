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
import type { ConfigStarter } from "@/types/configuration";
import type { ConfigValue, ConfigurationBuilderState } from "@/types/configuration-builder";
import { buildListItemIds } from "./build-list-item-ids";

export function hasUserValues(current: ConfigValue | undefined): boolean {
  return current !== undefined && current !== null;
}

// Recursive sibling of hasUserValues: walks objects/arrays and returns true
// only when at least one leaf carries actual content. Treats undefined, null,
// and empty string as empty (matching yaml-generator's stripEmpties). Use
// this when "the section/key is empty after edits" matters — e.g. mirroring
// values-tree presence to enabledSections.
export function hasMeaningfulLeaf(value: ConfigValue | undefined): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) {
    return value.some((v) => hasMeaningfulLeaf(v));
  }
  if (typeof value === "object") {
    return Object.values(value).some((v) => hasMeaningfulLeaf(v));
  }
  return true;
}

export function hydrateStarterState(
  version: string,
  starter: ConfigStarter | null
): ConfigurationBuilderState {
  const values = starter?.values ?? {};
  return {
    version,
    values,
    enabledSections: starter?.enabledSections ?? {},
    validationErrors: {},
    isDirty: false,
    listItemIds: buildListItemIds(values),
  };
}
