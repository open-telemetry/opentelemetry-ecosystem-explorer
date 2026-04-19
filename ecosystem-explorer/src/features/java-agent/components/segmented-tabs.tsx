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
import { useState, useRef, useLayoutEffect, useCallback, type JSX } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";

interface TabItem {
  value: string;
  label: string;
  icon?: JSX.Element;
}

interface SegmentedTabListProps {
  tabs: TabItem[];
  defaultValue: string;
}

export function SegmentedTabList({ tabs, defaultValue }: SegmentedTabListProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const measurePill = useCallback(() => {
    const el = buttonRefs.current[activeTab];
    if (el) {
      setPillStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab]);

  useLayoutEffect(() => {
    measurePill();
  }, [measurePill]);

  return (
    <RadixTabs.List
      className="relative inline-flex items-center rounded-xl p-1"
      style={{
        background: "oklch(0.22 0.035 260 / 0.8)",
        border: "1px solid oklch(1 0 0 / 0.08)",
      }}
    >
      {/* Sliding pill */}
      <span
        className="absolute top-1 bottom-1 rounded-lg"
        aria-hidden="true"
        style={{
          left: pillStyle.left,
          width: pillStyle.width,
          background: "oklch(0.78 0.16 75 / 0.12)",
          border: "1px solid oklch(0.78 0.16 75 / 0.4)",
          transition:
            "left 300ms cubic-bezier(0.22, 1, 0.36, 1), width 300ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />

      {tabs.map((tab) => (
        <RadixTabs.Trigger
          key={tab.value}
          value={tab.value}
          ref={(el) => {
            buttonRefs.current[tab.value] = el;
          }}
          onClick={() => setActiveTab(tab.value)}
          className={`relative z-10 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            activeTab === tab.value ? "" : "text-muted-foreground hover:text-foreground"
          }`}
          style={activeTab === tab.value ? { color: "oklch(0.78 0.16 75)" } : undefined}
        >
          {tab.icon && tab.icon}
          {tab.label}
        </RadixTabs.Trigger>
      ))}
    </RadixTabs.List>
  );
}
