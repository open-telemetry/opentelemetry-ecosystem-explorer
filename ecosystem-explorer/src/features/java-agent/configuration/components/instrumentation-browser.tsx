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
import { useState, useCallback, useMemo, type JSX } from "react";
import type { InstrumentationData, InstrumentationModule } from "@/types/javaagent";
import { Loader } from "@/components/ui/Loader";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import {
  useCustomizationStatusMap,
  type CustomizationStatus,
} from "@/hooks/use-customization-status";
import { useCustomizedModules } from "@/hooks/use-customized-modules";
import { groupByModule } from "@/lib/normalize-instrumentation";
import { SectionCardShell } from "./section-card-shell";
import { InstrumentationRow } from "./instrumentation-row";

export interface InstrumentationBrowserProps {
  instrumentations: InstrumentationData[] | null;
  loading: boolean;
  error: Error | null;
  search: string;
  statusFilter: "all" | "customized";
  onJumpToGeneral: (sectionKey: string) => void;
}

export function InstrumentationBrowser({
  instrumentations,
  loading,
  error,
  search,
  statusFilter,
  onJumpToGeneral,
}: InstrumentationBrowserProps): JSX.Element {
  const { setCustomization } = useConfigurationBuilder();
  const customizationMap = useCustomizationStatusMap();

  const modules = useMemo<InstrumentationModule[]>(
    () => (instrumentations ? groupByModule(instrumentations) : []),
    [instrumentations]
  );

  const customizedSet = useCustomizedModules(modules);
  const customizationCount = customizedSet.size;

  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => new Set());

  const toggleExpand = useCallback((name: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const trimmedSearch = search.trim();
  const filtered = useMemo(() => {
    const q = trimmedSearch.toLowerCase();
    return modules.filter((m) => {
      if (statusFilter === "customized" && !customizedSet.has(m.name)) return false;
      if (q && !matchesQuery(m, q)) return false;
      return true;
    });
  }, [modules, customizedSet, trimmedSearch, statusFilter]);

  const handleAddCustomization = useCallback(
    (m: InstrumentationModule) => {
      setCustomization(m.name, m.defaultDisabled ? "enabled" : "disabled");
    },
    [setCustomization]
  );

  const handleSetEnabled = useCallback(
    (name: string, enabled: boolean) => {
      setCustomization(name, enabled ? "enabled" : "disabled");
    },
    [setCustomization]
  );

  const handleRemoveCustomization = useCallback(
    (name: string) => {
      setCustomization(name, "none");
    },
    [setCustomization]
  );

  return (
    <SectionCardShell sectionKey="instrumentations">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-foreground text-base font-semibold">
          Instrumentations
          {modules.length > 0 ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              · {modules.length} modules
              {customizationCount > 0 ? ` · ${customizationCount} customized` : ""}
            </span>
          ) : null}
        </h3>
      </header>

      {loading ? (
        <Loader size="sm" label="Loading instrumentations…" />
      ) : error ? (
        <p className="text-sm text-red-400">Failed to load instrumentations.</p>
      ) : (
        <Body
          total={modules.length}
          filtered={filtered}
          customizationMap={customizationMap}
          expandedSet={expandedSet}
          search={trimmedSearch}
          statusFilter={statusFilter}
          customizationCount={customizationCount}
          onAddCustomization={handleAddCustomization}
          onSetEnabled={handleSetEnabled}
          onRemoveCustomization={handleRemoveCustomization}
          onToggleExpand={toggleExpand}
          onJumpToGeneral={onJumpToGeneral}
        />
      )}
    </SectionCardShell>
  );
}

interface BodyProps {
  total: number;
  filtered: InstrumentationModule[];
  customizationMap: Map<string, "enabled" | "disabled">;
  expandedSet: Set<string>;
  search: string;
  statusFilter: "all" | "customized";
  customizationCount: number;
  onAddCustomization: (m: InstrumentationModule) => void;
  onSetEnabled: (name: string, enabled: boolean) => void;
  onRemoveCustomization: (name: string) => void;
  onToggleExpand: (name: string) => void;
  onJumpToGeneral: (sectionKey: string) => void;
}

function Body({
  total,
  filtered,
  customizationMap,
  expandedSet,
  search,
  statusFilter,
  customizationCount,
  onAddCustomization,
  onSetEnabled,
  onRemoveCustomization,
  onToggleExpand,
  onJumpToGeneral,
}: BodyProps): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="border-border/40 bg-background/30 text-muted-foreground rounded-md border px-3 py-2 text-xs">
        {readout(total, filtered.length, search, statusFilter, customizationCount)}
      </div>

      {filtered.length === 0 ? (
        <EmptyState search={search} statusFilter={statusFilter} total={total} />
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((m) => {
            const status: CustomizationStatus = customizationMap.get(m.name) ?? "none";
            return (
              <li key={m.name}>
                <InstrumentationRow
                  module={m}
                  status={status}
                  isExpanded={expandedSet.has(m.name)}
                  onAddCustomization={() => onAddCustomization(m)}
                  onSetEnabled={(enabled) => onSetEnabled(m.name, enabled)}
                  onRemoveCustomization={() => onRemoveCustomization(m.name)}
                  onToggleExpand={() => onToggleExpand(m.name)}
                  onJumpToGeneral={onJumpToGeneral}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState({
  search,
  statusFilter,
  total,
}: {
  search: string;
  statusFilter: "all" | "customized";
  total: number;
}): JSX.Element {
  if (search) {
    return (
      <p className="text-muted-foreground text-sm">
        No instrumentations match &ldquo;{search}&rdquo;. Clear the search to show all {total}.
      </p>
    );
  }
  if (statusFilter === "customized") {
    return (
      <p className="text-muted-foreground text-sm">
        You haven&rsquo;t customized any instrumentation yet. Click &ldquo;+ Customize&rdquo; on a
        row to add one.
      </p>
    );
  }
  return <p className="text-muted-foreground text-sm">No instrumentations available.</p>;
}

function readout(
  total: number,
  shown: number,
  search: string,
  statusFilter: "all" | "customized",
  customizationCount: number
): string {
  if (search) return `Search "${search}" · ${shown} of ${total}`;
  if (statusFilter === "customized") return `Customized · ${customizationCount} of ${total}`;
  return `No filter · ${total} modules`;
}

function matchesQuery(m: InstrumentationModule, q: string): boolean {
  if (m.name.toLowerCase().includes(q)) return true;
  for (const e of m.coveredEntries) {
    if (e.name.toLowerCase().includes(q)) return true;
    if (e.display_name?.toLowerCase().includes(q)) return true;
    if (e.description?.toLowerCase().includes(q)) return true;
  }
  return false;
}
