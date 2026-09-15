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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelemetryComparisonSection } from "./telemetry-comparison-section";
import { useTelemetryComparison } from "../../hooks/use-telemetry-comparison";
import type { UseTelemetryComparisonResult } from "../../hooks/use-telemetry-comparison";
import type { VersionInfo } from "@/types/collector";

vi.mock("../../hooks/use-telemetry-comparison", () => ({
  useTelemetryComparison: vi.fn(),
}));

const VERSIONS: VersionInfo[] = [
  { version: "0.156.0", is_latest: true },
  { version: "0.155.0", is_latest: false },
  { version: "0.154.0", is_latest: false },
];

function mockResult(overrides: Partial<UseTelemetryComparisonResult> = {}) {
  const base: UseTelemetryComparisonResult = {
    fromVersion: "0.155.0",
    toVersion: "0.156.0",
    setFromVersion: vi.fn(),
    setToVersion: vi.fn(),
    diffResult: null,
    loading: false,
    error: null,
    fromNotFound: false,
    toNotFound: false,
    ...overrides,
  };
  vi.mocked(useTelemetryComparison).mockReturnValue(base);
  return base;
}

describe("TelemetryComparisonSection (collector)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults 'From' to the release immediately before the current version", () => {
    mockResult();
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    expect(useTelemetryComparison).toHaveBeenCalledWith(
      "core",
      "memorylimiterprocessor",
      "0.155.0",
      "0.156.0"
    );
  });

  it("falls back 'From' to the current version when viewing the oldest release", () => {
    mockResult();
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.154.0"
      />
    );
    expect(useTelemetryComparison).toHaveBeenCalledWith(
      "core",
      "memorylimiterprocessor",
      "0.154.0",
      "0.154.0"
    );
  });

  it("renders a loading state", () => {
    mockResult({ loading: true });
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders an error message", () => {
    mockResult({ error: new Error("boom") });
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders a same-version warning and no diff results when both versions match", () => {
    mockResult({ fromVersion: "0.156.0", toVersion: "0.156.0", diffResult: { metrics: [] } });
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    expect(
      screen.getByText("Choose two different versions to see a comparison.")
    ).toBeInTheDocument();
  });

  it("renders the empty-diff state when nothing changed", () => {
    mockResult({
      diffResult: { metrics: [{ status: "unchanged", name: "m", metric: {} as never }] },
    });
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    expect(screen.getByText("No differences found")).toBeInTheDocument();
  });

  it("renders added/removed/changed metric cards from the diff result", () => {
    mockResult({
      diffResult: {
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
      },
    });
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    expect(screen.getByText("added.metric")).toBeInTheDocument();
    expect(screen.getByText("changed.metric")).toBeInTheDocument();
  });
});
