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
