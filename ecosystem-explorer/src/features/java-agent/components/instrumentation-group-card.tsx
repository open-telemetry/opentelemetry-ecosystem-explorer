import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { InstrumentationData } from "@/types/javaagent";
import type { InstrumentationGroup } from "../utils/group-instrumentations";
import type { FilterState } from "./instrumentation-filter-bar";
import { InstrumentationCard } from "./instrumentation-card";
import { FILTER_STYLES } from "../styles/filter-styles";

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

function MultiInstrumentationGroupCard({
  group,
  activeFilters,
  version,
}: InstrumentationGroupCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Aggregate badges across all instrumentations in the group
  const hasSpans = group.instrumentations.some((instr) =>
    instr.telemetry?.some((t) => t.spans && t.spans.length > 0)
  );
  const hasMetrics = group.instrumentations.some((instr) =>
    instr.telemetry?.some((t) => t.metrics && t.metrics.length > 0)
  );
  const hasJavaAgentTarget = group.instrumentations.some(
    (instr) => instr.javaagent_target_versions && instr.javaagent_target_versions.length > 0
  );
  const hasLibraryTarget = group.instrumentations.some(
    (instr) => instr.has_standalone_library === true
  );

  const isJavaAgentFilterActive = activeFilters?.target.has("javaagent");
  const isLibraryFilterActive = activeFilters?.target.has("library");
  const isSpansFilterActive = activeFilters?.telemetry.has("spans");
  const isMetricsFilterActive = activeFilters?.telemetry.has("metrics");

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
              {hasJavaAgentTarget && (
                <span
                  className={`text-xs px-2 py-1 rounded border-2 transition-all ${
                    isJavaAgentFilterActive
                      ? FILTER_STYLES.target.javaagent.active
                      : FILTER_STYLES.target.javaagent.inactive
                  }`}
                  title="Java Agent"
                >
                  Agent
                </span>
              )}
              {hasLibraryTarget && (
                <span
                  className={`text-xs px-2 py-1 rounded border-2 transition-all ${
                    isLibraryFilterActive
                      ? FILTER_STYLES.target.library.active
                      : FILTER_STYLES.target.library.inactive
                  }`}
                  title="Standalone Library"
                >
                  Library
                </span>
              )}
            </div>
          </div>

          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 pl-6">{description}</p>
          )}

          <div className="flex flex-wrap gap-2 items-center pl-6">
            {hasSpans && (
              <span
                className={`text-xs px-2 py-1 rounded border-2 transition-all ${
                  isSpansFilterActive
                    ? FILTER_STYLES.telemetry.spans.active
                    : FILTER_STYLES.telemetry.spans.inactive
                }`}
              >
                Spans
              </span>
            )}
            {hasMetrics && (
              <span
                className={`text-xs px-2 py-1 rounded border-2 transition-all ${
                  isMetricsFilterActive
                    ? FILTER_STYLES.telemetry.metrics.active
                    : FILTER_STYLES.telemetry.metrics.inactive
                }`}
              >
                Metrics
              </span>
            )}
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

interface SubInstrumentationItemProps {
  instrumentation: InstrumentationData;
  version: string;
  activeFilters?: FilterState;
}

function SubInstrumentationItem({
  instrumentation,
  version,
  activeFilters,
}: SubInstrumentationItemProps) {
  const hasSpans = instrumentation.telemetry?.some((t) => t.spans && t.spans.length > 0);
  const hasMetrics = instrumentation.telemetry?.some((t) => t.metrics && t.metrics.length > 0);
  const hasJavaAgentTarget =
    instrumentation.javaagent_target_versions &&
    instrumentation.javaagent_target_versions.length > 0;
  const hasLibraryTarget = instrumentation.has_standalone_library === true;

  const isSpansFilterActive = activeFilters?.telemetry.has("spans");
  const isMetricsFilterActive = activeFilters?.telemetry.has("metrics");
  const isJavaAgentFilterActive = activeFilters?.target.has("javaagent");
  const isLibraryFilterActive = activeFilters?.target.has("library");

  const detailUrl = `/java-agent/instrumentation/${version}/${instrumentation.name}`;

  return (
    <Link
      to={detailUrl}
      className="block p-3 rounded-md border-l-2 border-primary/30 bg-background/50 hover:bg-card-secondary/50 hover:border-primary/60 transition-colors"
      aria-label={`View details for ${instrumentation.name}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium">{instrumentation.name}</span>
          {instrumentation.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {instrumentation.description}
            </p>
          )}
        </div>

        <div className="flex gap-1 flex-shrink-0">
          {hasJavaAgentTarget && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded border transition-all ${
                isJavaAgentFilterActive
                  ? FILTER_STYLES.target.javaagent.active
                  : FILTER_STYLES.target.javaagent.inactive
              }`}
            >
              Agent
            </span>
          )}
          {hasLibraryTarget && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded border transition-all ${
                isLibraryFilterActive
                  ? FILTER_STYLES.target.library.active
                  : FILTER_STYLES.target.library.inactive
              }`}
            >
              Library
            </span>
          )}
          {hasSpans && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded border transition-all ${
                isSpansFilterActive
                  ? FILTER_STYLES.telemetry.spans.active
                  : FILTER_STYLES.telemetry.spans.inactive
              }`}
            >
              Spans
            </span>
          )}
          {hasMetrics && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded border transition-all ${
                isMetricsFilterActive
                  ? FILTER_STYLES.telemetry.metrics.active
                  : FILTER_STYLES.telemetry.metrics.inactive
              }`}
            >
              Metrics
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
