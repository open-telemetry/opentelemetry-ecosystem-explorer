import { getTelemetryFilterClasses, getTargetFilterClasses } from "../styles/filter-styles";

export interface FilterState {
  search: string;
  telemetry: Set<"spans" | "metrics">;
  target: Set<"javaagent" | "library">;
}

interface InstrumentationFilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function InstrumentationFilterBar({
  filters,
  onFiltersChange,
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

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="space-y-2">
        <label htmlFor="search" className="text-sm font-medium">
          Search
        </label>
        <input
          id="search"
          type="text"
          placeholder="Search instrumentations..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Telemetry</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => toggleTelemetry("spans")}
              aria-pressed={filters.telemetry.has("spans")}
              className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all font-medium ${getTelemetryFilterClasses(
                "spans",
                filters.telemetry.has("spans")
              )}`}
            >
              Spans
            </button>
            <button
              onClick={() => toggleTelemetry("metrics")}
              aria-pressed={filters.telemetry.has("metrics")}
              className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all font-medium ${getTelemetryFilterClasses(
                "metrics",
                filters.telemetry.has("metrics")
              )}`}
            >
              Metrics
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Type</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => toggleTarget("javaagent")}
              aria-pressed={filters.target.has("javaagent")}
              className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all font-medium ${getTargetFilterClasses(
                "javaagent",
                filters.target.has("javaagent")
              )}`}
            >
              Java Agent
            </button>
            <button
              onClick={() => toggleTarget("library")}
              aria-pressed={filters.target.has("library")}
              className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all font-medium ${getTargetFilterClasses(
                "library",
                filters.target.has("library")
              )}`}
            >
              Standalone
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
