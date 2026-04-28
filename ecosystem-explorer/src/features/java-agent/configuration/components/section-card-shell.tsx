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
import type { JSX, ReactNode } from "react";

export interface SectionCardShellProps {
  sectionKey: string;
  children: ReactNode;
}

/**
 * Outer chrome for a top-level configuration section card.
 * Provides the data attribute required by the scroll-spy and the focus
 * target for keyboard navigation. The active-section indicator lives on
 * the TOC sidebar only.
 */
export function SectionCardShell({ sectionKey, children }: SectionCardShellProps): JSX.Element {
  return (
    <section
      data-section-key={sectionKey}
      tabIndex={-1}
      className="border-border bg-card relative isolate space-y-3 overflow-hidden rounded-lg border p-6 focus:outline-none"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border-hsl)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border-hsl)) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="relative z-[1] space-y-3">{children}</div>
    </section>
  );
}
