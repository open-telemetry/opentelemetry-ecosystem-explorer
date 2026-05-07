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
import { compareReleases } from "./release-diff";
import type { InstrumentationData, Metric, Span, Configuration } from "@/types/javaagent";

/** Create a minimal Metric mock keyed by name. */
function makeMetric(name: string, description = ""): Metric {
  return { name, description } as unknown as Metric;
}

/** Create a minimal Span mock keyed by span_kind. */
function makeSpan(span_kind: Span["span_kind"]): Span {
  return { span_kind } as unknown as Span;
}

/** Create a minimal Configuration mock. */
function makeConfig(name: string, description = "", type = "string"): Configuration {
  return { name, description, type } as unknown as Configuration;
}

describe("release-diff utility", () => {
  const mockInstrumentation = (
    name: string,
    metrics: Metric[] = [],
    spans: Span[] = [],
    configurations: Configuration[] = []
  ): InstrumentationData => ({
    name,
    display_name: `${name} Display`,
    scope: { name: "test" },
    telemetry: [
      {
        when: "default",
        metrics,
        spans,
      },
    ],
    configurations,
  });

  it("should detect added, removed and changed instrumentations", () => {
    const fromData: InstrumentationData[] = [
      mockInstrumentation("instr1", [makeMetric("metric1")]),
      mockInstrumentation("instr2"),
    ];

    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [makeMetric("metric1"), makeMetric("metric2")]),
      mockInstrumentation("instr3"),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    expect(diff.totals.added).toBe(1);
    expect(diff.totals.removed).toBe(1);
    expect(diff.totals.changed).toBe(1);

    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.status).toBe("changed");

    const instr2 = diff.instrumentations.find((i) => i.id === "instr2");
    expect(instr2?.status).toBe("removed");

    const instr3 = diff.instrumentations.find((i) => i.id === "instr3");
    expect(instr3?.status).toBe("added");
  });

  it("should handle identical instrumentations as unchanged", () => {
    const fromData: InstrumentationData[] = [mockInstrumentation("instr1")];
    const toData: InstrumentationData[] = [mockInstrumentation("instr1")];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    expect(diff.totals.added).toBe(0);
    expect(diff.totals.removed).toBe(0);
    expect(diff.totals.changed).toBe(0);

    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.status).toBe("unchanged");
  });

  it("should detect span changes as changed", () => {
    // Spans are keyed by span_kind; adding a new kind triggers a diff
    const fromData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [makeSpan("CLIENT")]),
    ];
    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [makeSpan("CLIENT"), makeSpan("SERVER")]),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    expect(diff.totals.changed).toBe(1);
    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.status).toBe("changed");
  });

  it("should detect config description changes", () => {
    const fromData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [], [makeConfig("config1", "old desc")]),
    ];
    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [], [makeConfig("config1", "new desc")]),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    expect(diff.totals.changed).toBe(1);
    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.status).toBe("changed");
    expect(instr1?.configDiff?.changed).toContain("config1");
  });

  it("should detect added and removed config keys", () => {
    const fromData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [], [makeConfig("old-config")]),
    ];
    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [], [makeConfig("new-config")]),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.configDiff?.added).toContain("new-config");
    expect(instr1?.configDiff?.removed).toContain("old-config");
  });

  it("should compute aggregate metrics from the target release", () => {
    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [makeMetric("http.requests", "Total HTTP requests")]),
      mockInstrumentation("instr2", [
        makeMetric("http.requests", "Total HTTP requests"),
        makeMetric("db.queries", "Total DB queries"),
      ]),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", [], toData);

    expect(diff.aggregateMetrics).toHaveLength(2);

    const httpMetric = diff.aggregateMetrics.find((m) => m.name === "http.requests");
    expect(httpMetric?.emittedBy).toHaveLength(2);
    expect(httpMetric?.emittedBy).toContain("instr1 Display");
    expect(httpMetric?.emittedBy).toContain("instr2 Display");

    const dbMetric = diff.aggregateMetrics.find((m) => m.name === "db.queries");
    expect(dbMetric?.emittedBy).toHaveLength(1);
  });

  it("should return empty diff for empty inputs", () => {
    const diff = compareReleases("1.0.0", "1.1.0", [], []);

    expect(diff.totals.added).toBe(0);
    expect(diff.totals.removed).toBe(0);
    expect(diff.totals.changed).toBe(0);
    expect(diff.instrumentations).toHaveLength(0);
    expect(diff.aggregateMetrics).toHaveLength(0);
  });

  it("should sort aggregate metrics alphabetically", () => {
    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [makeMetric("z.metric"), makeMetric("a.metric")]),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", [], toData);

    expect(diff.aggregateMetrics[0].name).toBe("a.metric");
    expect(diff.aggregateMetrics[1].name).toBe("z.metric");
  });
});
