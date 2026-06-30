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
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelemetryComparisonSection } from "./telemetry-comparison-section";
import * as useTelemetryComparisonModule from "../../hooks/use-telemetry-comparison";
import type { VersionInfo } from "@/types/javaagent";

vi.mock("../../hooks/use-telemetry-comparison", () => ({
  useTelemetryComparison: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const noopHookReturn: useTelemetryComparisonModule.UseTelemetryComparisonResult = {
  fromVersion: "1.0.0",
  toVersion: "1.0.0",
  setFromVersion: vi.fn(),
  setToVersion: vi.fn(),
  whenCondition: "default",
  setWhenCondition: vi.fn(),
  availableConditions: ["default"],
  diffResult: null,
  loading: false,
  error: null,
  fromNotFound: false,
  toNotFound: false,
};

const versions: VersionInfo[] = [
  { version: "2.0.0", is_latest: true },
  { version: "1.5.0", is_latest: false },
  { version: "1.0.0", is_latest: false },
];

describe("TelemetryComparisonSection — defaultFromVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTelemetryComparisonModule.useTelemetryComparison).mockReturnValue(noopHookReturn);
  });

  it("uses the next-older version as From when viewing the latest version", () => {
    render(
      <TelemetryComparisonSection
        instrumentationName="jdbc"
        versions={versions}
        currentVersion="2.0.0"
      />
    );
    expect(useTelemetryComparisonModule.useTelemetryComparison).toHaveBeenCalledWith(
      "jdbc",
      "1.5.0",
      "2.0.0"
    );
  });

  it("uses the next-older version as From when viewing a middle version", () => {
    render(
      <TelemetryComparisonSection
        instrumentationName="jdbc"
        versions={versions}
        currentVersion="1.5.0"
      />
    );
    expect(useTelemetryComparisonModule.useTelemetryComparison).toHaveBeenCalledWith(
      "jdbc",
      "1.0.0",
      "1.5.0"
    );
  });

  // Regression for issue #727: previously fell back to versions[0] (latest), producing an
  // inverted From=latest / To=oldest comparison.
  it("uses currentVersion as From when viewing the oldest version (no older version exists)", () => {
    render(
      <TelemetryComparisonSection
        instrumentationName="jdbc"
        versions={versions}
        currentVersion="1.0.0"
      />
    );
    expect(useTelemetryComparisonModule.useTelemetryComparison).toHaveBeenCalledWith(
      "jdbc",
      "1.0.0", // From = oldest (same as To) — triggers same-version warning, not inverted diff
      "1.0.0"
    );
  });
});
