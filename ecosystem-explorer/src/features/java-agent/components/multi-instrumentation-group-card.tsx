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
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { InstrumentationGroup } from "../utils/group-instrumentations";
import type { FilterState } from "./instrumentation-filter-bar";
import { getAggregatedBadgeInfo } from "../utils/badge-info";
import { TargetBadges, TelemetryBadges } from "./instrumentation-badges";
import { SubInstrumentationItem } from "./sub-instrumentation-item";

interface MultiInstrumentationGroupCardProps {
  group: InstrumentationGroup;
  activeFilters?: FilterState;
  version: string;
}

export function MultiInstrumentationGroupCard({
  group,
  activeFilters,
  version,
}: MultiInstrumentationGroupCardProps) {
  const [expanded, setExpanded] = useState(false);

  const badges = useMemo(
    () => getAggregatedBadgeInfo(group.instrumentations),
    [group.instrumentations]
  );

  // Use the first instrumentation's description as the group description
  const description = group.instrumentations.find((i) => i.description)?.description;

  return (
    <div className="border border-border rounded-lg bg-card flex flex-col h-full overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="p-4 w-full text-left hover:bg-card-secondary/50 transition-colors cursor-pointer"
        aria-expanded={expanded}
        aria-label={`${group.displayName} group with ${group.instrumentations.length} instrumentations`}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                  expanded ? "rotate-0" : "-rotate-90"
                }`}
              />
              <h3 className="font-semibold text-lg leading-tight truncate">{group.displayName}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium flex-shrink-0">
                {group.instrumentations.length} versions
              </span>
            </div>

            <div className="flex gap-1 flex-shrink-0">
              <TargetBadges badges={badges} activeFilters={activeFilters} />
            </div>
          </div>

          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 pl-6">{description}</p>
          )}

          <div className="flex flex-wrap gap-2 items-center pl-6">
            <TelemetryBadges badges={badges} activeFilters={activeFilters} />
          </div>
        </div>
      </button>

      <div
        className={`grid transition-all duration-200 ease-in-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {expanded && (
            <div className="border-t border-border/50 px-4 pb-4 pt-2 space-y-2">
              {group.instrumentations.map((instr) => (
                <SubInstrumentationItem
                  key={instr.name}
                  instrumentation={instr}
                  version={version}
                  activeFilters={activeFilters}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
