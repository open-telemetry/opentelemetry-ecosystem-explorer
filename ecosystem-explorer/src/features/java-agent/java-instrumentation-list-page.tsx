import { BackButton } from "@/components/ui/back-button";
import { useVersions, useInstrumentations } from "@/hooks/use-javaagent-data";
import {
  type FilterState,
  InstrumentationFilterBar,
} from "@/features/java-agent/components/instrumentation-filter-bar.tsx";
import { useMemo, useState } from "react";
import { InstrumentationCard } from "@/features/java-agent/components/instrumentation-card.tsx";

export function JavaInstrumentationListPage() {
  const { data: versionsData, loading: versionsLoading } = useVersions();

  const latestVersion = versionsData?.versions.find((v) => v.is_latest)?.version ?? "";

  const {
    data: instrumentations,
    loading: instrumentationsLoading,
    error,
  } = useInstrumentations(latestVersion);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    telemetry: new Set(),
    target: new Set(),
  });

  const filteredInstrumentations = useMemo(() => {
    if (!instrumentations) return [];

    return instrumentations.filter((instr) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = (instr.display_name || instr.name).toLowerCase();
        const description = (instr.description || "").toLowerCase();

        if (!name.includes(searchLower) && !description.includes(searchLower)) {
          return false;
        }
      }

      if (filters.telemetry.size > 0) {
        const hasSpans = instr.telemetry?.some((t) => t.spans && t.spans.length > 0);
        const hasMetrics = instr.telemetry?.some((t) => t.metrics && t.metrics.length > 0);

        if (filters.telemetry.has("spans") && !hasSpans) {
          return false;
        }
        if (filters.telemetry.has("metrics") && !hasMetrics) {
          return false;
        }
      }

      if (filters.target.size > 0) {
        const hasJavaAgent =
          instr.target_versions?.javaagent && instr.target_versions.javaagent.length > 0;
        const hasLibrary =
          instr.target_versions?.library && instr.target_versions.library.length > 0;

        if (filters.target.has("javaagent") && !hasJavaAgent) {
          return false;
        }
        if (filters.target.has("library") && !hasLibrary) {
          return false;
        }
      }

      return true;
    });
  }, [instrumentations, filters]);

  if (versionsLoading || instrumentationsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-2">
            <div className="text-lg font-medium">Loading instrumentations...</div>
            <div className="text-sm text-muted-foreground">This may take a moment</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="p-6 border border-red-500/50 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
          <h3 className="font-semibold mb-2">Error loading instrumentations</h3>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!latestVersion) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="p-6 border border-yellow-500/50 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
          <h3 className="font-semibold mb-2">No version available</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            OpenTelemetry Java Agent Instrumentation
          </h1>
        </div>

        <InstrumentationFilterBar filters={filters} onFiltersChange={setFilters} />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredInstrumentations.length} of {instrumentations?.length ?? 0}{" "}
            instrumentations
          </div>
        </div>

        {filteredInstrumentations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No instrumentations found matching your filters.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredInstrumentations.map((instr) => (
              <InstrumentationCard
                key={instr.name}
                instrumentation={instr}
                activeFilters={filters}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
