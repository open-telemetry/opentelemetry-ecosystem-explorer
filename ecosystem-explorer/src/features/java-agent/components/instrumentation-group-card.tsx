import type { InstrumentationGroup } from "../utils/group-instrumentations";
import type { FilterState } from "./instrumentation-filter-bar";
import { InstrumentationCard } from "./instrumentation-card";
import { MultiInstrumentationGroupCard } from "./multi-instrumentation-group-card";

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
