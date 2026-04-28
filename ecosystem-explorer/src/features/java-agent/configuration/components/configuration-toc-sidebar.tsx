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
import { SegmentedTabList } from "@/components/ui/segmented-tabs";

export interface TocSection {
  key: string;
  label: string;
}

export interface ConfigurationTocSidebarProps {
  activeTab: string;
  sections: TocSection[];
  activeKey: string | null;
  onSectionClick: (key: string) => void;
}

const TABS = [
  { value: "sdk", label: "SDK" },
  { value: "instrumentation", label: "Instrumentation" },
];

const LINK_BASE = "block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors";
const LINK_ACTIVE = "bg-card/80 font-medium text-foreground";
const LINK_INACTIVE = "text-muted-foreground hover:bg-card/40 hover:text-foreground";

export function ConfigurationTocSidebar({
  activeTab,
  sections,
  activeKey,
  onSectionClick,
}: ConfigurationTocSidebarProps): JSX.Element {
  return (
    <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-auto">
      <SegmentedTabList tabs={TABS} value={activeTab} fullWidth />
      {activeTab === "sdk" && (
        <nav aria-label="Configuration sections" className="mt-3 space-y-0.5">
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
      )}
    </aside>
  );
}
