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
import type { JSX } from "react";
import { Search } from "lucide-react";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";

export interface TocSection {
  key: string;
  label: string;
}

export type StatusFilter = "all" | "overridden";

export interface ConfigurationTocSidebarProps {
  activeTab: string;
  sections: TocSection[];
  activeKey: string | null;
  onSectionClick: (key: string) => void;
  /** Only meaningful when activeTab === "instrumentation". */
  search?: string;
  onSearchChange?: (value: string) => void;
  statusFilter?: StatusFilter;
  onStatusFilterChange?: (value: StatusFilter) => void;
  overrideCount?: number;
}

const TABS = [
  { value: "sdk", label: "SDK" },
  { value: "instrumentation", label: "Instrumentation" },
];

const LINK_BASE = "block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors";
const LINK_ACTIVE = "bg-card/80 font-medium text-foreground";
const LINK_INACTIVE = "text-muted-foreground hover:bg-card/40 hover:text-foreground";

const SECTION_LABEL =
  "text-muted-foreground/80 mb-1.5 px-1 text-[10px] font-medium tracking-wider uppercase";

export function ConfigurationTocSidebar({
  activeTab,
  sections,
  activeKey,
  onSectionClick,
  search,
  onSearchChange,
  statusFilter = "all",
  onStatusFilterChange,
  overrideCount = 0,
}: ConfigurationTocSidebarProps): JSX.Element {
  const isInstrumentation = activeTab === "instrumentation";
  const showTocNav = activeTab === "sdk" || isInstrumentation;
  const showStatusSection = isInstrumentation && overrideCount > 0;
  const isOverriddenActive = statusFilter === "overridden";

  return (
    <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-auto">
      <SegmentedTabList tabs={TABS} value={activeTab} fullWidth />
      {isInstrumentation && (
        <div className="mt-3">
          <label className="relative block">
            <span className="sr-only">Search instrumentations</span>
            <Search
              aria-hidden="true"
              className="text-muted-foreground/70 pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
            />
            <input
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search instrumentations…"
              className="border-border/50 bg-card/40 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-primary/20 w-full rounded-md border py-1.5 pr-2 pl-8 text-sm focus:ring-1 focus:outline-none"
            />
          </label>
        </div>
      )}
      {showStatusSection && (
        <div className="mt-4">
          <div className={SECTION_LABEL}>Status</div>
          <button
            type="button"
            aria-pressed={isOverriddenActive}
            onClick={() => onStatusFilterChange?.(isOverriddenActive ? "all" : "overridden")}
            className={`${LINK_BASE} flex items-center justify-between ${
              isOverriddenActive ? LINK_ACTIVE : LINK_INACTIVE
            }`}
          >
            <span>Overridden</span>
            <span className="text-primary text-xs font-medium tabular-nums">{overrideCount}</span>
          </button>
        </div>
      )}
      {showTocNav && sections.length > 0 && (
        <div className="mt-4">
          {isInstrumentation && <div className={SECTION_LABEL}>On this page</div>}
          <nav aria-label="Configuration sections" className="space-y-0.5">
            {sections.map((section) => {
              const isActive = section.key === activeKey;
              return (
                <button
                  key={section.key}
                  type="button"
                  aria-current={isActive ? "location" : undefined}
                  onClick={() => onSectionClick(section.key)}
                  className={`${LINK_BASE} ${isActive ? LINK_ACTIVE : LINK_INACTIVE}`}
                >
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </aside>
  );
}
