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
import { useState, useRef, useLayoutEffect, useCallback, useEffect, type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";

interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface SegmentedTabListProps {
  tabs: TabItem[];
  value: string;
}

export function SegmentedTabList({ tabs, value }: SegmentedTabListProps) {
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const listRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const measurePill = useCallback(() => {
    const el = buttonRefs.current[value];
    if (el) {
      setPillStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [value]);

  useLayoutEffect(() => {
    measurePill();
  }, [measurePill]);

  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measurePill());
    observer.observe(listEl);
    return () => observer.disconnect();
  }, [measurePill]);

  return (
    <RadixTabs.List
      ref={listRef}
      className="relative inline-flex items-center rounded-xl border border-border/50 bg-muted/80 p-1"
    >
      {/* Sliding pill */}
      <span
        className="absolute top-1 bottom-1 rounded-lg border border-primary/40 bg-primary/12"
        aria-hidden="true"
        style={{
          left: pillStyle.left,
          width: pillStyle.width,
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
          className="relative z-10 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground"
        >
          {tab.icon}
          {tab.label}
        </RadixTabs.Trigger>
      ))}
    </RadixTabs.List>
  );
}
