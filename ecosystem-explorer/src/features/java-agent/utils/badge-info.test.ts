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
import { getBadgeInfo, getAggregatedBadgeInfo } from "./badge-info";
import type { InstrumentationData } from "@/types/javaagent";

function makeInstr(
  overrides: Partial<InstrumentationData> & { name: string }
): InstrumentationData {
  return { scope: { name: "test" }, ...overrides };
}

describe("getBadgeInfo", () => {
  it("returns all false for a bare instrumentation", () => {
    const info = getBadgeInfo(makeInstr({ name: "bare" }));
    expect(info).toEqual({
      hasSpans: false,
      hasMetrics: false,
      hasJavaAgentTarget: false,
      hasLibraryTarget: false,
    });
  });

  it("detects spans", () => {
    const info = getBadgeInfo(
      makeInstr({
        name: "with-spans",
        telemetry: [{ when: "always", spans: [{ span_kind: "CLIENT" }] }],
      })
    );
    expect(info.hasSpans).toBe(true);
    expect(info.hasMetrics).toBe(false);
  });

  it("detects metrics", () => {
    const info = getBadgeInfo(
      makeInstr({
        name: "with-metrics",
        telemetry: [
          {
            when: "always",
            metrics: [{ name: "m", description: "d", type: "COUNTER", unit: "1" }],
          },
        ],
      })
    );
    expect(info.hasMetrics).toBe(true);
    expect(info.hasSpans).toBe(false);
  });

  it("detects javaagent target", () => {
    const info = getBadgeInfo(makeInstr({ name: "agent", javaagent_target_versions: ["1.0"] }));
    expect(info.hasJavaAgentTarget).toBe(true);
  });

  it("detects standalone library", () => {
    const info = getBadgeInfo(makeInstr({ name: "lib", has_standalone_library: true }));
    expect(info.hasLibraryTarget).toBe(true);
  });
});

describe("getAggregatedBadgeInfo", () => {
  it("returns all false for empty array", () => {
    expect(getAggregatedBadgeInfo([])).toEqual({
      hasSpans: false,
      hasMetrics: false,
      hasJavaAgentTarget: false,
      hasLibraryTarget: false,
    });
  });

  it("aggregates across multiple instrumentations", () => {
    const instrumentations = [
      makeInstr({
        name: "a",
        telemetry: [{ when: "always", spans: [{ span_kind: "CLIENT" }] }],
      }),
      makeInstr({
        name: "b",
        has_standalone_library: true,
        telemetry: [
          {
            when: "always",
            metrics: [{ name: "m", description: "d", type: "GAUGE", unit: "1" }],
          },
        ],
      }),
      makeInstr({ name: "c", javaagent_target_versions: ["1.0"] }),
    ];

    const info = getAggregatedBadgeInfo(instrumentations);
    expect(info).toEqual({
      hasSpans: true,
      hasMetrics: true,
      hasJavaAgentTarget: true,
      hasLibraryTarget: true,
    });
  });

  it("returns false when no instrumentation has a capability", () => {
    const instrumentations = [makeInstr({ name: "a" }), makeInstr({ name: "b" })];

    const info = getAggregatedBadgeInfo(instrumentations);
    expect(info).toEqual({
      hasSpans: false,
      hasMetrics: false,
      hasJavaAgentTarget: false,
      hasLibraryTarget: false,
    });
  });
});
