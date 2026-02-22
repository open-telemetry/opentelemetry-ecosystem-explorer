import { Link } from "react-router-dom";
import type { InstrumentationData } from "@/types/javaagent";
import type { FilterState } from "./instrumentation-filter-bar";
import { getBadgeInfo } from "../utils/badge-info";
import { TargetBadges, TelemetryBadges } from "./instrumentation-badges";

interface SubInstrumentationItemProps {
  instrumentation: InstrumentationData;
  version: string;
  activeFilters?: FilterState;
}

export function SubInstrumentationItem({
  instrumentation,
  version,
  activeFilters,
}: SubInstrumentationItemProps) {
  const badges = getBadgeInfo(instrumentation);
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
          <TargetBadges badges={badges} activeFilters={activeFilters} size="compact" />
          <TelemetryBadges badges={badges} activeFilters={activeFilters} size="compact" />
        </div>
      </div>
    </Link>
  );
}
