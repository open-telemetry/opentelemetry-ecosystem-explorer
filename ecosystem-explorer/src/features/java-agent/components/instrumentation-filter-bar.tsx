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
import { useMemo } from "react";
import { getTelemetryFilterClasses, getTargetFilterClasses } from "../styles/filter-styles";
import { Tooltip } from "@/components/ui/tooltip";
import { SearchableMultiSelect, SelectedChips } from "@/components/ui/searchable-multi-select";

import { getSemanticConventionInfo, getFeatureInfo } from "../utils/format";

import type { InstrumentationData } from "@/types/javaagent";

export interface FilterState {
  search: string;
  telemetry: Set<"spans" | "metrics">;
  target: Set<"javaagent" | "library">;
  semantic: string[];
  features: string[];
}

interface InstrumentationFilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  instrumentations: InstrumentationData[];
}

export function InstrumentationFilterBar({
  filters,
  onFiltersChange,
  instrumentations,
}: InstrumentationFilterBarProps) {
  const toggleTelemetry = (type: "spans" | "metrics") => {
    const newTelemetry = new Set(filters.telemetry);
    if (newTelemetry.has(type)) {
      newTelemetry.delete(type);
    } else {
      newTelemetry.add(type);
    }
    onFiltersChange({ ...filters, telemetry: newTelemetry });
  };

  const toggleTarget = (type: "javaagent" | "library") => {
    const newTarget = new Set(filters.target);
    if (newTarget.has(type)) {
      newTarget.delete(type);
    } else {
      newTarget.add(type);
    }
    onFiltersChange({ ...filters, target: newTarget });
  };

  const semanticOptions = useMemo(() => {
    const options = new Set<string>();
    instrumentations.forEach((instr) => {
      instr.semantic_conventions?.forEach((s) => options.add(s));
    });
    return Array.from(options).sort();
  }, [instrumentations]);

  const featureOptions = useMemo(() => {
    const options = new Set<string>();
    instrumentations.forEach((instr) => {
      instr.features?.forEach((f) => options.add(f));
    });
    return Array.from(options).sort();
  }, [instrumentations]);

  return (
    <div className="border-border/60 bg-card/80 relative overflow-hidden rounded-lg border p-6">
      {/* Ambient radial gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top left, hsl(var(--otel-orange-hsl) / 0.08) 0%, hsl(var(--otel-blue-hsl) / 0.04) 40%, transparent 70%)",
        }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
        <div className="absolute inset-0 opacity-5">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border-hsl)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border-hsl)) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
        </div>
      </div>

      <div className="relative z-40 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="search" className="text-muted-foreground text-sm font-medium">
              Search
            </label>
            <div className="relative">
              <input
                id="search"
                type="text"
                placeholder="Search instrumentations..."
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                className="border-border/60 bg-background/80 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/20 flex h-[42px] w-full rounded-lg border px-4 py-2 text-sm backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none"
              />
            </div>
          </div>

          <SearchableMultiSelect
            label="Semantic Conventions"
            placeholder="Filter by convention..."
            options={semanticOptions}
            selected={filters.semantic}
            onChange={(selected) => onFiltersChange({ ...filters, semantic: selected })}
            renderOption={(s) => getSemanticConventionInfo(s)?.label ?? s}
          />

          <SearchableMultiSelect
            label="Features"
            placeholder="Filter by feature..."
            options={featureOptions}
            selected={filters.features}
            onChange={(selected) => onFiltersChange({ ...filters, features: selected })}
            renderOption={(f) => getFeatureInfo(f)?.label ?? f}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="text-muted-foreground text-sm font-medium">Telemetry</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toggleTelemetry("spans")}
                aria-pressed={filters.telemetry.has("spans")}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${getTelemetryFilterClasses(
                  "spans",
                  filters.telemetry.has("spans")
                )}`}
              >
                Spans
              </button>
              <button
                onClick={() => toggleTelemetry("metrics")}
                aria-pressed={filters.telemetry.has("metrics")}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${getTelemetryFilterClasses(
                  "metrics",
                  filters.telemetry.has("metrics")
                )}`}
              >
                Metrics
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-muted-foreground text-sm font-medium">Type</div>
            <div className="flex flex-wrap gap-2">
              <Tooltip content="Standard instrumentation that runs alongside the application using a Java agent.">
                <button
                  onClick={() => toggleTarget("javaagent")}
                  aria-pressed={filters.target.has("javaagent")}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${getTargetFilterClasses(
                    "javaagent",
                    filters.target.has("javaagent")
                  )}`}
                >
                  Java Agent
                </button>
              </Tooltip>
              <Tooltip content="Standalone libraries are installed manually and for use without the agent.">
                <button
                  onClick={() => toggleTarget("library")}
                  aria-pressed={filters.target.has("library")}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${getTargetFilterClasses(
                    "library",
                    filters.target.has("library")
                  )}`}
                >
                  Standalone
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SelectedChips
            selected={filters.semantic}
            onRemove={(item) =>
              onFiltersChange({
                ...filters,
                semantic: filters.semantic.filter((s) => s !== item),
              })
            }
            renderItem={(s) => getSemanticConventionInfo(s)?.label ?? s}
          />
          <SelectedChips
            selected={filters.features}
            onRemove={(item) =>
              onFiltersChange({
                ...filters,
                features: filters.features.filter((f) => f !== item),
              })
            }
            renderItem={(f) => getFeatureInfo(f)?.label ?? f}
          />
        </div>
      </div>

      {/* Corner accent */}
      <div className="pointer-events-none absolute -right-1 -bottom-1 h-20 w-20 opacity-60">
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <path
            d="M64 64 L64 40 L52 40 L52 52 L40 52 L40 64 Z"
            style={{ fill: "hsl(var(--otel-orange-hsl) / 0.4)" }}
          />
        </svg>
      </div>
    </div>
  );
}
