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
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_30px_hsl(var(--primary-hsl)/0.12)]">
      {/* Grid pattern background */}
      <div className="absolute inset-0 opacity-[0.15]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border-hsl)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border-hsl)) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="relative z-10 w-full cursor-pointer p-6 text-left transition-colors hover:bg-card-secondary/50"
        aria-expanded={expanded}
        aria-label={`${group.displayName} group with ${group.instrumentations.length} instrumentations`}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ChevronDown
                aria-hidden="true"
                className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
                  expanded ? "rotate-0" : "-rotate-90"
                }`}
              />
              <h3 className="truncate text-lg font-semibold leading-tight">{group.displayName}</h3>
              <span className="flex-shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
                {group.instrumentations.length} versions
              </span>
            </div>

            <div className="flex flex-shrink-0 gap-1">
              <TargetBadges badges={badges} activeFilters={activeFilters} />
            </div>
          </div>

          {description && (
            <p className="line-clamp-2 pl-8 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pl-8">
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
            <div className="relative z-10 space-y-2 border-t border-border/50 px-6 pb-6 pt-4">
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
