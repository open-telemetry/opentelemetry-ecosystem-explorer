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
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTelemetryComparison } from "./use-telemetry-comparison";
import * as javaagentData from "@/lib/api/javaagent-data";
import { compareTelemetry, getAvailableWhenConditions } from "../utils/telemetry-diff";
import type { InstrumentationData, TelemetryDiffResult } from "@/types/javaagent";

vi.mock("@/lib/api/javaagent-data", () => ({
  loadInstrumentation: vi.fn(),
}));

vi.mock("../utils/telemetry-diff", () => ({
  compareTelemetry: vi.fn(),
  getAvailableWhenConditions: vi.fn(),
}));

const INSTRUMENTATION_NAME = "kafka-clients";
const STUB_INSTRUMENTATION = { name: INSTRUMENTATION_NAME } as InstrumentationData;

describe("useTelemetryComparison hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAvailableWhenConditions).mockReturnValue(["default", "experimental"]);
    // Echo the `when` condition compareTelemetry was called with into the (real)
    // optional SpanDiff.whenCondition field, so tests can assert which condition
    // a given diffResult was actually computed for.
    vi.mocked(compareTelemetry).mockImplementation(
      (_from, _to, when = "default"): TelemetryDiffResult => ({
        metrics: [],
        spans: [{ status: "added", span: { span_kind: "CONSUMER" }, whenCondition: when }],
      })
    );
  });

  it("uses the whenCondition selected while a version fetch was in flight, not the one active when the fetch started (#795 regression)", async () => {
    let resolveToVersion: (value: InstrumentationData) => void;

    vi.mocked(javaagentData.loadInstrumentation).mockImplementation(async (_id, version) => {
      if (version === "2.0.0") {
        return new Promise<InstrumentationData>((resolve) => {
          resolveToVersion = resolve;
        });
      }
      return STUB_INSTRUMENTATION;
    });

    const { result, rerender } = renderHook(
      ({ toVersion }: { toVersion: string }) =>
        useTelemetryComparison(INSTRUMENTATION_NAME, "1.0.0", toVersion),
      { initialProps: { toVersion: "1.5.0" } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.diffResult?.spans[0]?.whenCondition).toBe("default");

    // 1. A new version comparison request starts...
    rerender({ toVersion: "2.0.0" });
    await waitFor(() => expect(result.current.loading).toBe(true));

    // 2. ...request is intentionally left pending (resolveToVersion not yet called)
    //    while the user changes the when-condition.
    act(() => {
      result.current.setWhenCondition("experimental");
    });

    // 3. The delayed request now resolves.
    resolveToVersion!(STUB_INSTRUMENTATION);

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The diff must be computed using the latest whenCondition ("experimental"),
    // not "default" (the value active when the version fetch started).
    expect(result.current.whenCondition).toBe("experimental");
    expect(result.current.diffResult?.spans[0]?.whenCondition).toBe("experimental");
  });
});
