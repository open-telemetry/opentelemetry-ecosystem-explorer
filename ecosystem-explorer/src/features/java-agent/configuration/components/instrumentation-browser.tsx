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
import { useTranslation } from "react-i18next";
import type { InstrumentationData, InstrumentationModule } from "@/types/javaagent";
import { Loader } from "@/components/ui/loader";
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
  const { t } = useTranslation("java-agent");
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
          {t("builder.browser.title")}
          {modules.length > 0 ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              {t("builder.browser.count", { count: modules.length })}
              {customizationCount > 0
                ? t("builder.browser.customized", { count: customizationCount })
                : ""}
            </span>
          ) : null}
        </h3>
      </header>

      {loading ? (
        <Loader size="sm" label={t("builder.browser.loading")} />
      ) : error ? (
        <p className="text-sm text-red-400">{t("builder.browser.error")}</p>
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
  const { t } = useTranslation("java-agent");
  return (
    <div className="space-y-3">
      <div className="border-border/40 bg-background/30 text-muted-foreground rounded-md border px-3 py-2 text-xs">
        {search
          ? t("builder.browser.readout.search", { search, shown: filtered.length, total })
          : statusFilter === "customized"
            ? t("builder.browser.readout.customized", { count: customizationCount, total })
            : t("builder.browser.readout.noFilter", { count: total })}
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
  const { t } = useTranslation("java-agent");
  if (search) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("builder.browser.empty.search", { search, total })}
      </p>
    );
  }
  if (statusFilter === "customized") {
    return <p className="text-muted-foreground text-sm">{t("builder.browser.empty.customized")}</p>;
  }
  return <p className="text-muted-foreground text-sm">{t("builder.browser.empty.empty")}</p>;
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
