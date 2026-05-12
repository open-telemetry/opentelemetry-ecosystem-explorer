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
import { Link } from "react-router-dom";
import type { InstrumentationData } from "@/types/javaagent";
import type { FilterState } from "./instrumentation-filter-bar";
import { getBadgeInfo } from "../utils/badge-info";
import { TargetBadges, TelemetryBadges } from "./instrumentation-badges";
import { getInstrumentationDisplayName } from "../utils/format";
import { renderWithInlineCode } from "@/lib/render-inline-code";

interface InstrumentationCardProps {
  instrumentation: InstrumentationData;
  activeFilters?: FilterState;
  version: string;
}

export function InstrumentationCard({
  instrumentation,
  activeFilters,
  version,
}: InstrumentationCardProps) {
  const displayName = getInstrumentationDisplayName(instrumentation);
  const badgeInfo = getBadgeInfo(instrumentation);
  const detailUrl = `/java-agent/instrumentation/${version}/${instrumentation.name}`;

  return (
    <Link
      to={detailUrl}
      className="group border-border bg-card hover:border-secondary/40 hover:bg-card-secondary relative flex h-full flex-col overflow-hidden rounded-lg border p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_hsl(var(--otel-orange-hsl)/0.12)]"
      aria-label={`View details for ${displayName}`}
    >
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

      {/* Content */}
      <div className="relative z-10 flex-1 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex-1 text-lg leading-tight font-semibold">{displayName}</h3>
          <div className="flex flex-shrink-0 gap-1">
            <TargetBadges badges={badgeInfo} activeFilters={activeFilters} />
          </div>
        </div>

        {instrumentation.description && (
          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
            {renderWithInlineCode(instrumentation.description)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <TelemetryBadges badges={badgeInfo} activeFilters={activeFilters} />
        </div>
      </div>
    </Link>
  );
}
