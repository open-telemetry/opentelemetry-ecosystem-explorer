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
import { useComponentVersions } from "@/hooks/use-collector-data";
import type { VersionInfo } from "@/types/collector";

vi.mock("../../hooks/use-telemetry-comparison", () => ({
  useTelemetryComparison: vi.fn(),
}));

vi.mock("@/hooks/use-collector-data", () => ({
  useComponentVersions: vi.fn(),
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
    // Default: the component exists in every version passed in, matching the pre-scoping
    // behavior for tests that aren't specifically exercising the scoping logic.
    vi.mocked(useComponentVersions).mockReturnValue({
      data: VERSIONS.map((v) => v.version),
      loading: false,
      error: null,
    });
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

  it("renders an error message without a low-contrast /80 opacity class", () => {
    mockResult({ error: new Error("boom") });
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    const message = screen.getByText("boom");
    expect(message).toBeInTheDocument();
    expect(message.className).not.toMatch(/\/80/);
  });

  it("renders a same-version warning (without a low-contrast /80 class) and no diff results when both versions match", () => {
    mockResult({ fromVersion: "0.156.0", toVersion: "0.156.0", diffResult: { metrics: [] } });
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    const message = screen.getByText("Choose two different versions to see a comparison.");
    expect(message).toBeInTheDocument();
    expect(message.className).not.toMatch(/\/80/);
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

  it("skips a release the component doesn't exist in when defaulting 'From', instead of the global release list", () => {
    // Regression guard: "0.155.0" is a real Collector release, but this component only
    // shipped in 0.156.0 and 0.154.0 (e.g. a core-only component skipping a contrib-only
    // release). Defaulting to the immediately-prior *global* release would pass a version
    // where loadComponent() throws, making every metric misreport as "added"/"removed".
    vi.mocked(useComponentVersions).mockReturnValue({
      data: ["0.156.0", "0.154.0"],
      loading: false,
      error: null,
    });
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
      "0.154.0",
      "0.156.0"
    );
  });

  it("only offers releases the component exists in in the version selectors", () => {
    vi.mocked(useComponentVersions).mockReturnValue({
      data: ["0.156.0", "0.154.0"],
      loading: false,
      error: null,
    });
    mockResult();
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    const fromSelect = screen.getByLabelText("From");
    expect(fromSelect).toHaveTextContent("0.156.0");
    expect(fromSelect).toHaveTextContent("0.154.0");
    expect(fromSelect).not.toHaveTextContent("0.155.0");
  });

  it("shows the loading state while the component's own version list is still loading", () => {
    vi.mocked(useComponentVersions).mockReturnValue({ data: null, loading: true, error: null });
    mockResult();
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

  it("shows a localized error state when the component's own version list fails to load, never the raw internal error", () => {
    // Regression guard: collector-data.ts throws internal messages like "Collector versions
    // index returned null unexpectedly" -- these must never reach the user directly.
    vi.mocked(useComponentVersions).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Collector versions index returned null unexpectedly"),
    });
    mockResult();
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    expect(screen.getByText("Comparison unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("Could not load the list of versions needed for comparison.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Collector versions index returned null unexpectedly")
    ).not.toBeInTheDocument();
  });

  it("shows a dedicated 'insufficient versions' message, not the version selector or 'same version' warning, when the component exists in only one release", () => {
    // Jay's repro: a component present in exactly one published release must not be told
    // "choose two different versions" -- there is no second version to choose.
    vi.mocked(useComponentVersions).mockReturnValue({
      data: ["0.156.0"],
      loading: false,
      error: null,
    });
    mockResult();
    render(
      <TelemetryComparisonSection
        distribution="contrib"
        name="adaptivetailsamplingprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    expect(screen.getByText("Version comparison unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This component is only present in one release, so there is no other version to compare it against."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Choose two different versions to see a comparison.")
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
  });

  it("shows the same 'insufficient versions' message when the component exists in zero scoped releases", () => {
    vi.mocked(useComponentVersions).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    });
    mockResult();
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    expect(screen.getByText("Version comparison unavailable")).toBeInTheDocument();
  });

  it("renders the normal comparison UI (not the insufficient-versions message) when two or more scoped versions exist", () => {
    vi.mocked(useComponentVersions).mockReturnValue({
      data: ["0.156.0", "0.155.0"],
      loading: false,
      error: null,
    });
    mockResult();
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={VERSIONS}
        currentVersion="0.156.0"
      />
    );
    expect(screen.queryByText("Version comparison unavailable")).not.toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
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
