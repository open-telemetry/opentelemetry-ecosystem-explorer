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
  it("groups added/removed metrics and changed metrics under their own headers, in that order", () => {
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
    // "Changed" is both the section header and the changed card's own status badge, so two
    // occurrences is what proves the header rendered alongside the badge.
    expect(screen.getAllByText("Changed")).toHaveLength(2);

    const text = container.textContent ?? "";
    expect(text.indexOf("Added & Removed")).toBeLessThan(text.indexOf("added.metric"));
    expect(text.indexOf("added.metric")).toBeLessThan(text.indexOf("changed.metric"));
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
