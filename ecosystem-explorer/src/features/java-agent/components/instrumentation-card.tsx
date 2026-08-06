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
import { ArrowRight } from "lucide-react";
import type { InstrumentationListEntry } from "@/types/javaagent";
import type { FilterState } from "./instrumentation-filter-bar";
import { getBadgeInfo } from "../utils/badge-info";
import { TargetBadges, TelemetryBadges } from "./instrumentation-badges";
import {
  getInstrumentationDisplayName,
  getSemanticConventionInfo,
  getFeatureInfo,
} from "../utils/format";
import { renderWithInlineCode } from "@/lib/render-inline-code";
import { GlowBadge } from "@/components/ui/glow-badge";

interface InstrumentationCardProps {
  instrumentation: InstrumentationListEntry;
  activeFilters?: FilterState;
  version: string | null;
}

export function InstrumentationCard({
  instrumentation,
  activeFilters,
  version,
}: InstrumentationCardProps) {
  const displayName = getInstrumentationDisplayName(instrumentation);
  const badgeInfo = getBadgeInfo(instrumentation);

  const detailUrl =
    version && version !== "latest"
      ? `/java-agent/instrumentation/${instrumentation.name}?version=${version}`
      : `/java-agent/instrumentation/${instrumentation.name}`;

  return (
    <Link
      to={detailUrl}
      className="group border-border bg-surface-card shadow-surface hover:border-secondary/40 hover:bg-card-secondary relative flex h-full flex-col overflow-hidden rounded-lg border p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_hsl(var(--secondary-hsl)/0.12)]"
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
      <div className="relative z-10 flex h-full flex-col space-y-4">
        {/* Header Region */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-foreground group-hover:text-primary flex-1 text-xl leading-tight font-bold transition-colors">
            {displayName}
          </h3>
          <div className="flex flex-shrink-0 items-center gap-2">
            <div className="flex gap-1">
              <TargetBadges badges={badgeInfo} activeFilters={activeFilters} />
              <TelemetryBadges badges={badgeInfo} activeFilters={activeFilters} />
            </div>
            <div className="bg-primary/5 flex hidden h-8 w-8 flex-shrink-0 -translate-x-2 items-center justify-center rounded-full opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:flex">
              <ArrowRight className="text-primary h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Body Region */}
        <div className="flex-1 space-y-4">
          {instrumentation.description && (
            <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
              {renderWithInlineCode(instrumentation.description)}
            </p>
          )}

          <div className="space-y-2">
            {(instrumentation.semantic_conventions?.length || 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {instrumentation.semantic_conventions?.map((s) => {
                  const isActive =
                    !activeFilters ||
                    activeFilters.semantic.length === 0 ||
                    activeFilters.semantic.includes(s);
                  const info = getSemanticConventionInfo(s);
                  return (
                    <GlowBadge
                      key={s}
                      variant="accent"
                      className={`px-1.5 py-0 ${isActive ? "" : "opacity-40 grayscale"}`}
                    >
                      {info?.label ?? s}
                    </GlowBadge>
                  );
                })}
              </div>
            )}

            {(instrumentation.features?.length || 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {instrumentation.features?.map((f) => {
                  const isActive =
                    !activeFilters ||
                    activeFilters.features.length === 0 ||
                    activeFilters.features.includes(f);
                  const info = getFeatureInfo(f);
                  return (
                    <GlowBadge
                      key={f}
                      variant="info"
                      className={`px-1.5 py-0 ${isActive ? "" : "opacity-40 grayscale"}`}
                    >
                      {info?.label ?? f}
                    </GlowBadge>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
