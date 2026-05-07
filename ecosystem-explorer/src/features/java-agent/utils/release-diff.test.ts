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
import type {
  InstrumentationData,
  Metric,
  Span,
  Configuration,
} from "@/types/javaagent";

describe("release-diff utility", () => {
  const mockInstrumentation = (
    name: string,
    metrics: Metric[] = [],
    spans: Span[] = [],
    configurations: Configuration[] = [],
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
      mockInstrumentation("instr1", [{ name: "metric1" } as Metric]),
      mockInstrumentation("instr2"),
    ];

    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [
        { name: "metric1" } as Metric,
        { name: "metric2" } as Metric,
      ]),
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
    const fromData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [{ name: "span1" } as Span]),
    ];
    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [
        { name: "span1" } as Span,
        { name: "span2" } as Span,
      ]),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    expect(diff.totals.changed).toBe(1);
    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.status).toBe("changed");
  });

  it("should detect config changes as changed", () => {
    const fromData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [], [
        { name: "config1", description: "old desc", type: "string" } as Configuration,
      ]),
    ];
    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [], [
        { name: "config1", description: "new desc", type: "string" } as Configuration,
      ]),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    expect(diff.totals.changed).toBe(1);
    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.status).toBe("changed");
    expect(instr1?.configDiff?.changed).toContain("config1");
  });

  it("should detect added and removed config keys", () => {
    const fromData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [], [
        { name: "old-config", description: "old", type: "boolean" } as Configuration,
      ]),
    ];
    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [], [], [
        { name: "new-config", description: "new", type: "string" } as Configuration,
      ]),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.configDiff?.added).toContain("new-config");
    expect(instr1?.configDiff?.removed).toContain("old-config");
  });

  it("should compute aggregate metrics from the target release", () => {
    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [
        { name: "http.requests", description: "Total HTTP requests" } as Metric,
      ]),
      mockInstrumentation("instr2", [
        { name: "http.requests", description: "Total HTTP requests" } as Metric,
        { name: "db.queries", description: "Total DB queries" } as Metric,
      ]),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", [], toData);

    expect(diff.aggregateMetrics).toHaveLength(2);

    const httpMetric = diff.aggregateMetrics.find(
      (m) => m.name === "http.requests",
    );
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
      mockInstrumentation("instr1", [
        { name: "z.metric" } as Metric,
        { name: "a.metric" } as Metric,
      ]),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", [], toData);

    expect(diff.aggregateMetrics[0].name).toBe("a.metric");
    expect(diff.aggregateMetrics[1].name).toBe("z.metric");
  });
});
