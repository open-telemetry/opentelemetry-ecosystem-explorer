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
import type { InstrumentationGroup } from "../utils/group-instrumentations";
import type { FilterState } from "./instrumentation-filter-bar";
import { InstrumentationCard } from "./instrumentation-card";
import { MultiInstrumentationGroupCard } from "./multi-instrumentation-group-card";

interface InstrumentationGroupCardProps {
  group: InstrumentationGroup;
  activeFilters?: FilterState;
  version: string;
}

export function InstrumentationGroupCard({
  group,
  activeFilters,
  version,
}: InstrumentationGroupCardProps) {
  // Singleton groups render as a normal card
  if (group.instrumentations.length === 1) {
    return (
      <InstrumentationCard
        instrumentation={group.instrumentations[0]}
        activeFilters={activeFilters}
        version={version}
      />
    );
  }

  return (
    <MultiInstrumentationGroupCard group={group} activeFilters={activeFilters} version={version} />
  );
}
