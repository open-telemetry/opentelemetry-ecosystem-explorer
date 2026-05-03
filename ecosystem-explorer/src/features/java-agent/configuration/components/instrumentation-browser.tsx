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
import { useCallback, useMemo, type JSX } from "react";
import type { InstrumentationModule } from "@/types/javaagent";
import { useInstrumentations } from "@/hooks/use-javaagent-data";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { useOverrideStatusMap, type OverrideStatus } from "@/hooks/use-override-status";
import { groupByModule } from "@/lib/normalize-instrumentation";
import { SectionCardShell } from "./section-card-shell";
import { InstrumentationRow } from "./instrumentation-row";

export interface InstrumentationBrowserProps {
  version: string;
  search: string;
  statusFilter: "all" | "overridden";
}

export function InstrumentationBrowser({
  version,
  search,
  statusFilter,
}: InstrumentationBrowserProps): JSX.Element {
  const { data: instrumentations, loading, error } = useInstrumentations(version);
  const { setOverride } = useConfigurationBuilder();
  const overrideMap = useOverrideStatusMap();

  const modules = useMemo<InstrumentationModule[]>(
    () => (instrumentations ? groupByModule(instrumentations) : []),
    [instrumentations]
  );

  const overrideCount = overrideMap.size;

  const trimmedSearch = search.trim();
  const filtered = useMemo(() => {
    const q = trimmedSearch.toLowerCase();
    return modules.filter((m) => {
      if (statusFilter === "overridden" && (overrideMap.get(m.name) ?? "none") === "none")
        return false;
      if (q && !matchesQuery(m, q)) return false;
      return true;
    });
  }, [modules, overrideMap, trimmedSearch, statusFilter]);

  const handleAddOverride = useCallback(
    (m: InstrumentationModule) => {
      setOverride(m.name, m.defaultDisabled ? "enabled" : "disabled");
    },
    [setOverride]
  );

  const handleSetEnabled = useCallback(
    (name: string, enabled: boolean) => {
      setOverride(name, enabled ? "enabled" : "disabled");
    },
    [setOverride]
  );

  const handleRemoveOverride = useCallback(
    (name: string) => {
      setOverride(name, "none");
    },
    [setOverride]
  );

  return (
    <SectionCardShell sectionKey="instrumentations">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-foreground text-base font-semibold">
          Instrumentations
          {modules.length > 0 ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              · {modules.length} modules
              {overrideCount > 0 ? ` · ${overrideCount} overridden` : ""}
            </span>
          ) : null}
        </h3>
      </header>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading instrumentations…</p>
      ) : error ? (
        <p className="text-sm text-red-400">Failed to load instrumentations.</p>
      ) : (
        <Body
          total={modules.length}
          filtered={filtered}
          overrideMap={overrideMap}
          search={trimmedSearch}
          statusFilter={statusFilter}
          overrideCount={overrideCount}
          onAddOverride={handleAddOverride}
          onSetEnabled={handleSetEnabled}
          onRemoveOverride={handleRemoveOverride}
        />
      )}
    </SectionCardShell>
  );
}

interface BodyProps {
  total: number;
  filtered: InstrumentationModule[];
  overrideMap: Map<string, "enabled" | "disabled">;
  search: string;
  statusFilter: "all" | "overridden";
  overrideCount: number;
  onAddOverride: (m: InstrumentationModule) => void;
  onSetEnabled: (name: string, enabled: boolean) => void;
  onRemoveOverride: (name: string) => void;
}

function Body({
  total,
  filtered,
  overrideMap,
  search,
  statusFilter,
  overrideCount,
  onAddOverride,
  onSetEnabled,
  onRemoveOverride,
}: BodyProps): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="border-border/40 bg-background/30 text-muted-foreground rounded-md border px-3 py-2 text-xs">
        {readout(total, filtered.length, search, statusFilter, overrideCount)}
      </div>

      {filtered.length === 0 ? (
        <EmptyState search={search} statusFilter={statusFilter} total={total} />
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((m) => {
            const status: OverrideStatus = overrideMap.get(m.name) ?? "none";
            return (
              <li key={m.name}>
                <InstrumentationRow
                  module={m}
                  status={status}
                  onAddOverride={() => onAddOverride(m)}
                  onSetEnabled={(enabled) => onSetEnabled(m.name, enabled)}
                  onRemoveOverride={() => onRemoveOverride(m.name)}
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
  statusFilter: "all" | "overridden";
  total: number;
}): JSX.Element {
  if (search) {
    return (
      <p className="text-muted-foreground text-sm">
        No instrumentations match &ldquo;{search}&rdquo;. Clear the search to show all {total}.
      </p>
    );
  }
  if (statusFilter === "overridden") {
    return (
      <p className="text-muted-foreground text-sm">
        You haven&rsquo;t overridden any instrumentation yet. Click &ldquo;+ Override&rdquo; on a
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
  statusFilter: "all" | "overridden",
  overrideCount: number
): string {
  if (search) return `Search "${search}" · ${shown} of ${total}`;
  if (statusFilter === "overridden") return `Overridden · ${overrideCount} of ${total}`;
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
