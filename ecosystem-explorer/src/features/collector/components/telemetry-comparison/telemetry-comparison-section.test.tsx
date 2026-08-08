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
import * as useTelemetryComparisonModule from "../../hooks/use-telemetry-comparison";
import type { VersionInfo } from "@/types/collector";

vi.mock("../../hooks/use-telemetry-comparison", () => ({
  useTelemetryComparison: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const noopHookReturn: useTelemetryComparisonModule.UseCollectorTelemetryComparisonResult = {
  fromVersion: "0.100.0",
  toVersion: "0.100.0",
  setFromVersion: vi.fn(),
  setToVersion: vi.fn(),
  diffResult: null,
  loading: false,
  error: null,
  fromNotFound: false,
  toNotFound: false,
};

const versions: VersionInfo[] = [
  { version: "0.102.0", is_latest: true },
  { version: "0.101.0", is_latest: false },
  { version: "0.100.0", is_latest: false },
];

describe("TelemetryComparisonSection (collector) — defaultFromVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTelemetryComparisonModule.useTelemetryComparison).mockReturnValue(noopHookReturn);
  });

  it("uses the next-older version as From when viewing the latest version", () => {
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={versions}
        currentVersion="0.102.0"
      />
    );
    expect(useTelemetryComparisonModule.useTelemetryComparison).toHaveBeenCalledWith(
      "core",
      "memorylimiterprocessor",
      "0.101.0",
      "0.102.0"
    );
  });

  it("uses the next-older version as From when viewing a middle version", () => {
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={versions}
        currentVersion="0.101.0"
      />
    );
    expect(useTelemetryComparisonModule.useTelemetryComparison).toHaveBeenCalledWith(
      "core",
      "memorylimiterprocessor",
      "0.100.0",
      "0.101.0"
    );
  });

  it("uses currentVersion as From when viewing the oldest version (no older version exists)", () => {
    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={versions}
        currentVersion="0.100.0"
      />
    );
    expect(useTelemetryComparisonModule.useTelemetryComparison).toHaveBeenCalledWith(
      "core",
      "memorylimiterprocessor",
      "0.100.0", // From = oldest (same as To) — triggers same-version warning, not inverted diff
      "0.100.0"
    );
  });
});

describe("TelemetryComparisonSection (collector) — rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the comparison is in flight", () => {
    vi.mocked(useTelemetryComparisonModule.useTelemetryComparison).mockReturnValue({
      ...noopHookReturn,
      fromVersion: "0.100.0",
      toVersion: "0.101.0",
      loading: true,
    });

    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={versions}
        currentVersion="0.101.0"
      />
    );

    expect(screen.getByText("telemetryComparison.loading")).toBeInTheDocument();
  });

  it("shows an error message when the comparison fails", () => {
    vi.mocked(useTelemetryComparisonModule.useTelemetryComparison).mockReturnValue({
      ...noopHookReturn,
      fromVersion: "0.100.0",
      toVersion: "0.101.0",
      error: new Error("boom"),
    });

    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={versions}
        currentVersion="0.101.0"
      />
    );

    expect(screen.getByText("telemetryComparison.error.title")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows the same-version warning instead of a diff when From equals To", () => {
    vi.mocked(useTelemetryComparisonModule.useTelemetryComparison).mockReturnValue({
      ...noopHookReturn,
      fromVersion: "0.100.0",
      toVersion: "0.100.0",
      diffResult: { metrics: [] },
    });

    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={versions}
        currentVersion="0.100.0"
      />
    );

    expect(screen.getByText("telemetryComparison.warnings.sameVersion.title")).toBeInTheDocument();
  });

  it("renders diff results when the comparison succeeds", () => {
    vi.mocked(useTelemetryComparisonModule.useTelemetryComparison).mockReturnValue({
      ...noopHookReturn,
      fromVersion: "0.100.0",
      toVersion: "0.101.0",
      diffResult: {
        metrics: [
          {
            status: "added",
            name: "processor_memory_limiter_refused_spans",
            metric: { description: "d", enabled: true, unit: "{span}" },
          },
        ],
      },
    });

    render(
      <TelemetryComparisonSection
        distribution="core"
        name="memorylimiterprocessor"
        versions={versions}
        currentVersion="0.101.0"
      />
    );

    expect(screen.getByText("processor_memory_limiter_refused_spans")).toBeInTheDocument();
  });
});
