import type { InstrumentationData } from "@/types/javaagent";
import { getSemanticConventionDisplayNames } from "@/lib/utils/semantic-conventions";
import type { FilterState } from "./instrumentation-filter-bar";
import { FILTER_STYLES } from "../styles/filter-styles";

interface InstrumentationCardProps {
  instrumentation: InstrumentationData;
  activeFilters?: FilterState;
}

export function InstrumentationCard({ instrumentation, activeFilters }: InstrumentationCardProps) {
  const hasSpans = instrumentation.telemetry?.some((t) => t.spans && t.spans.length > 0);
  const hasMetrics = instrumentation.telemetry?.some((t) => t.metrics && t.metrics.length > 0);

  const displayName = instrumentation.display_name || instrumentation.name;

  const hasJavaAgentTarget =
    instrumentation.target_versions?.javaagent &&
    instrumentation.target_versions.javaagent.length > 0;
  const hasLibraryTarget =
    instrumentation.target_versions?.library && instrumentation.target_versions.library.length > 0;

  const semanticConventions = getSemanticConventionDisplayNames(
    instrumentation.semantic_conventions
  );

  const isJavaAgentFilterActive = activeFilters?.target.has("javaagent");
  const isLibraryFilterActive = activeFilters?.target.has("library");
  const isSpansFilterActive = activeFilters?.telemetry.has("spans");
  const isMetricsFilterActive = activeFilters?.telemetry.has("metrics");

  return (
    <div className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors bg-card flex flex-col h-full">
      <div className="flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg leading-tight">{displayName}</h3>

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

        {instrumentation.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {instrumentation.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 items-center">
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

      {semanticConventions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
          {semanticConventions.map((convention) => (
            <span
              key={convention}
              className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded border border-purple-500/20"
            >
              {convention}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
