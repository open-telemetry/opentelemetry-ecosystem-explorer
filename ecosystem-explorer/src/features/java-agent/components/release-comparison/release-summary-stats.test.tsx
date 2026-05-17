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

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReleaseSummaryStats } from "./release-summary-stats";
import type { ReleaseDiffSummary } from "@/features/java-agent/hooks/use-release-diff";

function makeSummary(overrides: Partial<ReleaseDiffSummary> = {}): ReleaseDiffSummary {
  return {
    instrumentationsAdded: 0,
    instrumentationsRemoved: 0,
    instrumentationsChanged: 0,
    instrumentationsUnchanged: 0,
    totalMetricsAdded: 0,
    totalMetricsRemoved: 0,
    totalMetricsChanged: 0,
    totalSpansAdded: 0,
    totalSpansRemoved: 0,
    totalSpansChanged: 0,
    ...overrides,
  };
}

describe("ReleaseSummaryStats", () => {
  it("renders both version labels", () => {
    render(<ReleaseSummaryStats summary={makeSummary()} fromVersion="2.26.1" toVersion="2.27.0" />);
    expect(screen.getByText("2.26.1")).toBeInTheDocument();
    expect(screen.getByText("2.27.0")).toBeInTheDocument();
  });

  it("renders instrumentation counts in stat cells", () => {
    render(
      <ReleaseSummaryStats
        summary={makeSummary({ instrumentationsAdded: 3, instrumentationsChanged: 7 })}
        fromVersion="a"
        toVersion="b"
      />
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders all four status labels", () => {
    render(<ReleaseSummaryStats summary={makeSummary()} fromVersion="a" toVersion="b" />);
    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(screen.getByText("Removed")).toBeInTheDocument();
    expect(screen.getByText("Changed")).toBeInTheDocument();
    expect(screen.getByText("Unchanged")).toBeInTheDocument();
  });

  it("hides telemetry changes section when all telemetry counts are zero", () => {
    render(<ReleaseSummaryStats summary={makeSummary()} fromVersion="a" toVersion="b" />);
    // Use exact string to avoid matching the sr-only <dt> descriptions
    expect(screen.queryByText("Telemetry Changes")).not.toBeInTheDocument();
  });

  it("shows telemetry changes section when metrics are added", () => {
    render(
      <ReleaseSummaryStats
        summary={makeSummary({ totalMetricsAdded: 5 })}
        fromVersion="a"
        toVersion="b"
      />
    );
    expect(screen.getByText("Telemetry Changes")).toBeInTheDocument();
    expect(screen.getByText(/\+5 metrics/)).toBeInTheDocument();
  });

  it("shows telemetry changes section when spans are removed", () => {
    render(
      <ReleaseSummaryStats
        summary={makeSummary({ totalSpansRemoved: 2 })}
        fromVersion="a"
        toVersion="b"
      />
    );
    expect(screen.getByText("Telemetry Changes")).toBeInTheDocument();
    expect(screen.getByText(/2 spans/)).toBeInTheDocument();
  });

  it("shows modified metrics count", () => {
    render(
      <ReleaseSummaryStats
        summary={makeSummary({ totalMetricsChanged: 4 })}
        fromVersion="a"
        toVersion="b"
      />
    );
    expect(screen.getByText(/4 metrics modified/)).toBeInTheDocument();
  });

  it("shows modified spans count", () => {
    render(
      <ReleaseSummaryStats
        summary={makeSummary({ totalSpansChanged: 3 })}
        fromVersion="a"
        toVersion="b"
      />
    );
    expect(screen.getByText(/3 spans modified/)).toBeInTheDocument();
  });
});
