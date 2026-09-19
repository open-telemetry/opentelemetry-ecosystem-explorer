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
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DiffResultsSection } from "./diff-results-section";
import type { CollectorTelemetryDiffResult } from "@/types/collector";

describe("DiffResultsSection (collector)", () => {
  it("reuses the shared SectionDivider (border-b-2 rule) instead of a locally duplicated gradient-line variant", () => {
    // Regression guard: this component previously defined its own local `SectionDivider`
    // (a gradient-line variant) instead of reusing @/components/ui/section-divider, creating
    // a third visually distinct divider implementation alongside the shared one and the
    // Java Agent's own local copy.
    const diffResult: CollectorTelemetryDiffResult = {
      metrics: [
        {
          status: "added",
          name: "added.metric",
          metric: { description: "d", enabled: true, unit: "1" },
        },
        {
          status: "changed",
          name: "changed.metric",
          metric: { description: "d", enabled: true, unit: "1" },
          changes: { attributes: { added: [], removed: [], changed: [] } },
        },
      ],
    };
    const { container } = render(<DiffResultsSection diffResult={diffResult} />);

    expect(screen.getByText("Added & Removed")).toBeInTheDocument();
    // "Changed" also appears as the second metric card's status badge, so scope this query to
    // the divider label's characteristic classes (shared component only) to disambiguate.
    const dividerLabels = container.querySelectorAll("span.px-8");
    expect(Array.from(dividerLabels).map((el) => el.textContent)).toEqual([
      "Added & Removed",
      "Changed",
    ]);

    // The shared SectionDivider renders a `border-b-2` rule either side of the label; the old
    // local variant used `bg-gradient-to-r`/`bg-gradient-to-l` lines instead.
    expect(container.querySelectorAll(".border-b-2").length).toBeGreaterThan(0);
    expect(container.querySelector(".bg-gradient-to-r")).not.toBeInTheDocument();
    expect(container.querySelector(".bg-gradient-to-l")).not.toBeInTheDocument();
  });

  it("renders the empty-diff state when nothing changed", () => {
    const diffResult: CollectorTelemetryDiffResult = {
      metrics: [
        { status: "unchanged", name: "m", metric: { description: "d", enabled: true, unit: "1" } },
      ],
    };
    render(<DiffResultsSection diffResult={diffResult} />);
    expect(screen.getByText("No differences found")).toBeInTheDocument();
  });
});
