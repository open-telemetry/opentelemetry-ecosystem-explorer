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
import { computeReleaseDiff } from "./use-release-diff";
import type { InstrumentationData } from "@/types/javaagent";

function makeInstr(
  name: string,
  overrides: Partial<InstrumentationData> = {}
): InstrumentationData {
  return {
    name,
    scope: { name: `io.opentelemetry.${name}` },
    ...overrides,
  };
}

describe("computeReleaseDiff", () => {
  it("returns empty diffs for empty inputs", () => {
    const { diffs, summary } = computeReleaseDiff([], []);
    expect(diffs).toHaveLength(0);
    expect(summary.instrumentationsAdded).toBe(0);
    expect(summary.instrumentationsRemoved).toBe(0);
    expect(summary.instrumentationsChanged).toBe(0);
    expect(summary.instrumentationsUnchanged).toBe(0);
  });

  it("marks instrumentation as added when only in toInstrs", () => {
    const { diffs } = computeReleaseDiff([], [makeInstr("new-lib")]);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe("added");
    expect(diffs[0].name).toBe("new-lib");
  });

  it("marks instrumentation as removed when only in fromInstrs", () => {
    const { diffs } = computeReleaseDiff([makeInstr("old-lib")], []);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe("removed");
    expect(diffs[0].name).toBe("old-lib");
  });

  it("marks instrumentation as unchanged when telemetry is identical", () => {
    const instr = makeInstr("stable", {
      telemetry: [{ when: "default", metrics: [], spans: [] }],
    });
    const { diffs } = computeReleaseDiff([instr], [instr]);
    expect(diffs[0].status).toBe("unchanged");
  });

  it("marks instrumentation as changed when a metric is added", () => {
    const from = makeInstr("changing", {
      telemetry: [{ when: "default", metrics: [], spans: [] }],
    });
    const to = makeInstr("changing", {
      telemetry: [
        {
          when: "default",
          metrics: [
            {
              name: "new.metric",
              description: "d",
              instrument: "counter",
              data_type: "COUNTER",
              unit: "1",
            },
          ],
          spans: [],
        },
      ],
    });
    const { diffs } = computeReleaseDiff([from], [to]);
    expect(diffs[0].status).toBe("changed");
    expect(diffs[0].metricsAdded).toBe(1);
    expect(diffs[0].metricsRemoved).toBe(0);
  });

  it("marks instrumentation as changed when a span is removed", () => {
    const from = makeInstr("changing", {
      telemetry: [{ when: "default", spans: [{ span_kind: "CLIENT" }] }],
    });
    const to = makeInstr("changing", {
      telemetry: [{ when: "default", spans: [] }],
    });
    const { diffs } = computeReleaseDiff([from], [to]);
    expect(diffs[0].status).toBe("changed");
    expect(diffs[0].spansRemoved).toBe(1);
  });

  it("counts metrics in added instrumentation from default telemetry", () => {
    const instr = makeInstr("brand-new", {
      telemetry: [
        {
          when: "default",
          metrics: [
            {
              name: "a",
              description: "d",
              instrument: "counter",
              data_type: "COUNTER",
              unit: "1",
            },
            {
              name: "b",
              description: "d",
              instrument: "gauge",
              data_type: "LONG_GAUGE",
              unit: "ms",
            },
          ],
        },
      ],
    });
    const { diffs } = computeReleaseDiff([], [instr]);
    expect(diffs[0].metricsAdded).toBe(2);
    expect(diffs[0].spansAdded).toBe(0);
  });

  it("counts spans in removed instrumentation from default telemetry", () => {
    const instr = makeInstr("gone", {
      telemetry: [
        { when: "default", spans: [{ span_kind: "CLIENT" }, { span_kind: "SERVER" }] },
      ],
    });
    const { diffs } = computeReleaseDiff([instr], []);
    expect(diffs[0].spansRemoved).toBe(2);
    expect(diffs[0].metricsRemoved).toBe(0);
  });

  it("does not count non-default telemetry for added/removed instrumentation status", () => {
    const instr = makeInstr("new-lib", {
      telemetry: [
        {
          when: "when_feature_enabled",
          metrics: [
            { name: "x", description: "d", instrument: "counter", data_type: "COUNTER", unit: "1" },
          ],
        },
      ],
    });
    const { diffs } = computeReleaseDiff([], [instr]);
    // Only default telemetry counted — non-default condition metrics not included
    expect(diffs[0].metricsAdded).toBe(0);
  });

  it("sorts diffs: added before removed before changed before unchanged", () => {
    const fromInstrs = [makeInstr("removed-lib"), makeInstr("changed-lib"), makeInstr("unchanged-lib")];
    const toInstrs = [
      makeInstr("added-lib"),
      makeInstr("changed-lib", {
        telemetry: [
          {
            when: "default",
            metrics: [
              { name: "x", description: "d", instrument: "counter", data_type: "COUNTER", unit: "1" },
            ],
          },
        ],
      }),
      makeInstr("unchanged-lib"),
    ];
    const { diffs } = computeReleaseDiff(fromInstrs, toInstrs);
    const statuses = diffs.map((d) => d.status);
    expect(statuses.indexOf("added")).toBeLessThan(statuses.indexOf("removed"));
    expect(statuses.indexOf("removed")).toBeLessThan(statuses.indexOf("changed"));
    expect(statuses.indexOf("changed")).toBeLessThan(statuses.indexOf("unchanged"));
  });

  it("sorts alphabetically by displayName within same status", () => {
    const { diffs } = computeReleaseDiff(
      [],
      [makeInstr("zebra", { display_name: "Zebra" }), makeInstr("alpha", { display_name: "Alpha" })]
    );
    expect(diffs[0].displayName).toBe("Alpha");
    expect(diffs[1].displayName).toBe("Zebra");
  });

  it("computes summary counts correctly", () => {
    const fromInstrs = [makeInstr("removed-lib"), makeInstr("unchanged-lib")];
    const toInstrs = [makeInstr("added-lib"), makeInstr("unchanged-lib")];
    const { summary } = computeReleaseDiff(fromInstrs, toInstrs);
    expect(summary.instrumentationsAdded).toBe(1);
    expect(summary.instrumentationsRemoved).toBe(1);
    expect(summary.instrumentationsChanged).toBe(0);
    expect(summary.instrumentationsUnchanged).toBe(1);
  });

  it("accumulates totalMetricsAdded in summary", () => {
    const from = makeInstr("lib", { telemetry: [{ when: "default", metrics: [] }] });
    const to = makeInstr("lib", {
      telemetry: [
        {
          when: "default",
          metrics: [
            { name: "m1", description: "d", instrument: "counter", data_type: "COUNTER", unit: "1" },
            { name: "m2", description: "d", instrument: "gauge", data_type: "LONG_GAUGE", unit: "ms" },
          ],
        },
      ],
    });
    const { summary } = computeReleaseDiff([from], [to]);
    expect(summary.totalMetricsAdded).toBe(2);
    expect(summary.totalMetricsRemoved).toBe(0);
  });

  it("uses display_name when available", () => {
    const instr = makeInstr("akka-actor-2.3", { display_name: "Akka Actor" });
    const { diffs } = computeReleaseDiff([], [instr]);
    expect(diffs[0].displayName).toBe("Akka Actor");
  });

  it("falls back to a formatted name when display_name is absent", () => {
    // getInstrumentationDisplayName title-cases the name when no display_name is set
    const instr = makeInstr("raw-name");
    const { diffs } = computeReleaseDiff([], [instr]);
    expect(diffs[0].displayName).toBe("Raw Name");
  });

  it("uses fromInstr display_name for removed instrumentations", () => {
    const instr = makeInstr("lib", { display_name: "Removed Library" });
    const { diffs } = computeReleaseDiff([instr], []);
    expect(diffs[0].displayName).toBe("Removed Library");
  });
});
