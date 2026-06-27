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
import type { InstrumentationData, Metric } from "@/types/javaagent";

describe("release-diff utility", () => {
  const mockInstrumentation = (
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metrics: any[] = [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spans: any[] = []
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
  });

  it("should detect added, removed and changed instrumentations", () => {
    const fromData: InstrumentationData[] = [
      mockInstrumentation("instr1", [{ name: "metric1" }]),
      mockInstrumentation("instr2"),
    ];

    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [{ name: "metric1" }, { name: "metric2" }]),
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

  it("should detect telemetry differences under non-default when conditions", () => {
    const fromData: InstrumentationData[] = [
      {
        name: "instr1",
        display_name: "instr1 Display",
        scope: { name: "test" },
        telemetry: [
          { when: "default", metrics: [{ name: "metric1" }] as unknown as Metric[] },
          { when: "opt-in", metrics: [{ name: "opt-metric-old" }] as unknown as Metric[] },
        ],
      },
    ];

    const toData: InstrumentationData[] = [
      {
        name: "instr1",
        display_name: "instr1 Display",
        scope: { name: "test" },
        telemetry: [
          { when: "default", metrics: [{ name: "metric1" }] as unknown as Metric[] },
          { when: "opt-in", metrics: [{ name: "opt-metric-new" }] as unknown as Metric[] },
        ],
      },
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);
    expect(diff.totals.changed).toBe(1);
    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.status).toBe("changed");
    expect(
      instr1?.telemetryDiff.metrics.some(
        (m) => m.metric.name === "opt-metric-new" && m.status === "added"
      )
    ).toBe(true);
  });

  it("should aggregate metrics across all telemetry conditions without duplicating", () => {
    const toData: InstrumentationData[] = [
      {
        name: "instr1",
        display_name: "instr1 Display",
        scope: { name: "test" },
        telemetry: [
          {
            when: "default",
            metrics: [
              {
                name: "metric1",
                description: "d1",
                instrument: "counter",
                data_type: "COUNTER",
                unit: "1",
              },
            ],
          },
          {
            when: "opt-in",
            metrics: [
              {
                name: "metric1",
                description: "d1",
                instrument: "counter",
                data_type: "COUNTER",
                unit: "1",
              },
              {
                name: "metric2",
                description: "d2",
                instrument: "counter",
                data_type: "COUNTER",
                unit: "1",
              },
            ],
          },
        ],
      },
    ];

    const diff = compareReleases("1.0.0", "1.1.0", [], toData);
    expect(diff.aggregateMetrics.length).toBe(2);
    expect(diff.aggregateMetrics.map((m) => m.name)).toEqual(["metric1", "metric2"]);
    expect(diff.aggregateMetrics[0].emittedBy).toEqual(["instr1 Display"]);
  });

  it("should detect configuration changes in declarative_name and example", () => {
    const fromData: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        configurations: [
          {
            name: "config1",
            description: "desc",
            type: "string",
            default: "val",
            declarative_name: "Old Name",
            examples: ["ex1"],
          },
        ],
      },
    ];

    const toData1: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        configurations: [
          {
            name: "config1",
            description: "desc",
            type: "string",
            default: "val",
            declarative_name: "New Name",
            examples: ["ex1"],
          },
        ],
      },
    ];

    const toData2: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        configurations: [
          {
            name: "config1",
            description: "desc",
            type: "string",
            default: "val",
            declarative_name: "Old Name",
            examples: ["ex1", "ex2"],
          },
        ],
      },
    ];

    const diff1 = compareReleases("1.0.0", "1.1.0", fromData, toData1);
    expect(diff1.totals.changed).toBe(1);
    expect(diff1.instrumentations[0].configDiff?.changed).toContain("config1");

    const diff2 = compareReleases("1.0.0", "1.1.0", fromData, toData2);
    expect(diff2.totals.changed).toBe(1);
    expect(diff2.instrumentations[0].configDiff?.changed).toContain("config1");
  });

  it("should populate configDiff for added and removed instrumentations", () => {
    const fromData: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        configurations: [{ name: "config1", description: "desc", type: "string", default: "val" }],
      },
    ];

    const toData: InstrumentationData[] = [
      {
        name: "instr2",
        scope: { name: "test" },
        configurations: [{ name: "config2", description: "desc", type: "string", default: "val" }],
      },
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.status).toBe("removed");
    expect(instr1?.configDiff?.removed).toContain("config1");

    const instr2 = diff.instrumentations.find((i) => i.id === "instr2");
    expect(instr2?.status).toBe("added");
    expect(instr2?.configDiff?.added).toContain("config2");
  });
});

// Regression tests for issue #732: span moved between when-conditions should not
// appear as both removed and added.
describe("cross-condition span/metric deduplication", () => {
  it("collapses a span moved between when-conditions into changed (jaxrs-1.0 pattern)", () => {
    const fromData: InstrumentationData[] = [
      {
        name: "jaxrs-1.0",
        display_name: "JAX-RS 1.x",
        scope: { name: "io.opentelemetry.jaxrs-1.0" },
        telemetry: [
          {
            when: "default",
            spans: [
              {
                span_kind: "INTERNAL",
                attributes: [
                  { name: "code.function", type: "STRING" },
                  { name: "code.namespace", type: "STRING" },
                ],
              },
            ],
          },
        ],
      },
    ];

    const toData: InstrumentationData[] = [
      {
        name: "jaxrs-1.0",
        display_name: "JAX-RS 1.x",
        scope: { name: "io.opentelemetry.jaxrs-1.0" },
        telemetry: [
          {
            when: "otel.instrumentation.common.experimental.controller-telemetry.enabled=true",
            spans: [
              {
                span_kind: "INTERNAL",
                attributes: [
                  { name: "code.function", type: "STRING" },
                  { name: "code.namespace", type: "STRING" },
                ],
              },
            ],
          },
        ],
      },
    ];

    const diff = compareReleases("2.27.0", "2.28.1", fromData, toData);

    const instr = diff.instrumentations.find((i) => i.id === "jaxrs-1.0");
    // The span content is identical; only the when-condition label changed.
    // It must NOT appear as both removed and added — it must be a single "changed" entry
    // with the new whenCondition populated.
    expect(instr?.status).toBe("changed");
    expect(instr?.telemetryDiff.spans).toHaveLength(1);
    expect(instr?.telemetryDiff.spans[0].status).toBe("changed");
    expect(instr?.telemetryDiff.spans[0].whenCondition).toBe(
      "otel.instrumentation.common.experimental.controller-telemetry.enabled=true"
    );
    expect(instr?.telemetryDiff.spans.some((s) => s.status === "removed")).toBe(false);
    expect(instr?.telemetryDiff.spans.some((s) => s.status === "added")).toBe(false);
  });

  it("does not collapse when the span content changed across conditions", () => {
    // Same span_kind but extra attribute in the new version — NOT a pure condition rename.
    const fromData: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        telemetry: [
          {
            when: "default",
            spans: [
              { span_kind: "INTERNAL", attributes: [{ name: "code.function", type: "STRING" }] },
            ],
          },
        ],
      },
    ];

    const toData: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        telemetry: [
          {
            when: "some-flag=true",
            spans: [
              {
                span_kind: "INTERNAL",
                attributes: [
                  { name: "code.function", type: "STRING" },
                  { name: "code.namespace", type: "STRING" }, // extra attribute
                ],
              },
            ],
          },
        ],
      },
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);
    const instr = diff.instrumentations.find((i) => i.id === "instr1");
    // Content differs — must not be silently collapsed.
    expect(instr?.telemetryDiff.spans.some((s) => s.status === "removed")).toBe(true);
    expect(instr?.telemetryDiff.spans.some((s) => s.status === "added")).toBe(true);
  });

  it("preserves a genuinely removed span (no matching add in any condition)", () => {
    const fromData: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        telemetry: [
          {
            when: "default",
            spans: [{ span_kind: "CLIENT", attributes: [{ name: "http.url", type: "STRING" }] }],
          },
        ],
      },
    ];
    const toData: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        telemetry: [{ when: "default", spans: [] }],
      },
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);
    const instr = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr?.telemetryDiff.spans.some((s) => s.status === "removed")).toBe(true);
    expect(instr?.telemetryDiff.spans.some((s) => s.status === "added")).toBe(false);
  });

  it("preserves a genuinely added span (no matching remove in any condition)", () => {
    const fromData: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        telemetry: [{ when: "default", spans: [] }],
      },
    ];
    const toData: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        telemetry: [
          {
            when: "default",
            spans: [{ span_kind: "CLIENT", attributes: [{ name: "http.url", type: "STRING" }] }],
          },
        ],
      },
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);
    const instr = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr?.telemetryDiff.spans.some((s) => s.status === "added")).toBe(true);
    expect(instr?.telemetryDiff.spans.some((s) => s.status === "removed")).toBe(false);
  });

  it("collapses a metric moved between when-conditions into changed", () => {
    const fromData: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        telemetry: [
          {
            when: "default",
            metrics: [
              {
                name: "jvm.memory.used",
                description: "Memory used",
                instrument: "updowncounter",
                data_type: "LONG_SUM",
                unit: "By",
                attributes: [{ name: "pool", type: "STRING" }],
              },
            ],
          },
        ],
      },
    ];

    const toData: InstrumentationData[] = [
      {
        name: "instr1",
        scope: { name: "test" },
        telemetry: [
          {
            when: "some-flag=true",
            metrics: [
              {
                name: "jvm.memory.used",
                description: "Memory used",
                instrument: "updowncounter",
                data_type: "LONG_SUM",
                unit: "By",
                attributes: [{ name: "pool", type: "STRING" }],
              },
            ],
          },
        ],
      },
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);
    const instr = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr?.status).toBe("changed");
    expect(instr?.telemetryDiff.metrics).toHaveLength(1);
    expect(instr?.telemetryDiff.metrics[0].status).toBe("changed");
    expect(instr?.telemetryDiff.metrics[0].whenCondition).toBe("some-flag=true");
    expect(instr?.telemetryDiff.metrics.some((m) => m.status === "removed")).toBe(false);
    expect(instr?.telemetryDiff.metrics.some((m) => m.status === "added")).toBe(false);
  });
});
