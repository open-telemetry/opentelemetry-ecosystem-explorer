import { Link } from "react-router-dom";
import type { InstrumentationData } from "@/types/javaagent";
import type { FilterState } from "./instrumentation-filter-bar";
import { getBadgeInfo } from "../utils/badge-info";
import { TargetBadges, TelemetryBadges } from "./instrumentation-badges";
import { getInstrumentationDisplayName } from "../utils/format";

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
      className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors bg-card flex flex-col h-full"
      aria-label={`View details for ${displayName}`}
    >
      <div className="flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg leading-tight">{displayName}</h3>
          <div className="flex gap-1 flex-shrink-0">
            <TargetBadges badges={badgeInfo} activeFilters={activeFilters} />
          </div>
        </div>

        {instrumentation.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {instrumentation.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <TelemetryBadges badges={badgeInfo} activeFilters={activeFilters} />
        </div>
      </div>
    </Link>
  );
}
