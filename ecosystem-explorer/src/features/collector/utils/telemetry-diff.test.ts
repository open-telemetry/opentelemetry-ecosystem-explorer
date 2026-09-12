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
import { compareCollectorTelemetry } from "./telemetry-diff";
import type { CollectorComponent, CollectorMetric } from "@/types/collector";

function makeMetric(overrides: Partial<CollectorMetric> = {}): CollectorMetric {
  return {
    description: "A test metric",
    enabled: true,
    unit: "1",
    sum: { monotonic: true, value_type: "int" },
    ...overrides,
  };
}

function makeComponent(overrides: Partial<CollectorComponent> = {}): CollectorComponent {
  return {
    id: "core-testprocessor",
    name: "testprocessor",
    ecosystem: "collector",
    type: "processor",
    distribution: "core",
    ...overrides,
  };
}

describe("compareCollectorTelemetry", () => {
  it("returns an empty diff when neither component has telemetry", () => {
    const result = compareCollectorTelemetry(makeComponent(), makeComponent());
    expect(result.metrics).toEqual([]);
  });

  it("returns an empty diff when both components have an empty telemetry.metrics map", () => {
    const from = makeComponent({ telemetry: { metrics: {} } });
    const to = makeComponent({ telemetry: { metrics: {} } });
    expect(compareCollectorTelemetry(from, to).metrics).toEqual([]);
  });

  it("treats null components as having no telemetry, without throwing", () => {
    expect(compareCollectorTelemetry(null, null).metrics).toEqual([]);
  });

  it("reports a metric only present on the 'to' side as added", () => {
    const from = makeComponent({ telemetry: { metrics: {} } });
    const to = makeComponent({ telemetry: { metrics: { "new.metric": makeMetric() } } });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics).toEqual([
      { status: "added", name: "new.metric", metric: to.telemetry!.metrics!["new.metric"] },
    ]);
  });

  it("reports a metric only present on the 'from' side as removed", () => {
    const from = makeComponent({ telemetry: { metrics: { "old.metric": makeMetric() } } });
    const to = makeComponent({ telemetry: { metrics: {} } });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics).toEqual([
      { status: "removed", name: "old.metric", metric: from.telemetry!.metrics!["old.metric"] },
    ]);
  });

  it("treats a component with no telemetry field as an empty side (all metrics added)", () => {
    const from = makeComponent();
    const to = makeComponent({ telemetry: { metrics: { "my.metric": makeMetric() } } });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics).toEqual([
      { status: "added", name: "my.metric", metric: to.telemetry!.metrics!["my.metric"] },
    ]);
  });

  it("reports a byte-identical metric as unchanged, with no changes payload", () => {
    const metric = makeMetric();
    const from = makeComponent({ telemetry: { metrics: { "my.metric": metric } } });
    const to = makeComponent({ telemetry: { metrics: { "my.metric": { ...metric } } } });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics).toEqual([{ status: "unchanged", name: "my.metric", metric }]);
  });

  it("detects a description-only change", () => {
    const from = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ description: "before" }) } },
    });
    const to = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ description: "after" }) } },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].status).toBe("changed");
    expect(result.metrics[0].changes?.description).toEqual({ before: "before", after: "after" });
    expect(result.metrics[0].changes?.unit).toBeUndefined();
    expect(result.metrics[0].changes?.enabled).toBeUndefined();
    expect(result.metrics[0].changes?.stability).toBeUndefined();
    expect(result.metrics[0].changes?.metricType).toBeUndefined();
  });

  it("detects a unit-only change", () => {
    const from = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ unit: "ms" }) } },
    });
    const to = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ unit: "s" }) } },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].changes?.unit).toEqual({ before: "ms", after: "s" });
    expect(result.metrics[0].changes?.description).toBeUndefined();
  });

  it("detects an enabled-only change", () => {
    const from = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ enabled: true }) } },
    });
    const to = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ enabled: false }) } },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].changes?.enabled).toEqual({ before: true, after: false });
  });

  it("detects a stability-only change", () => {
    const from = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ stability: "alpha" }) } },
    });
    const to = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ stability: "beta" }) } },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].changes?.stability).toEqual({ before: "alpha", after: "beta" });
  });

  it("detects a metric-type change (sum -> gauge)", () => {
    const from = makeComponent({
      telemetry: {
        metrics: { "my.metric": makeMetric({ sum: { monotonic: true, value_type: "int" } }) },
      },
    });
    const to = makeComponent({
      telemetry: {
        metrics: {
          "my.metric": makeMetric({ sum: undefined, gauge: { value_type: "int" } }),
        },
      },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].changes?.metricType).toEqual({ before: "sum", after: "gauge" });
  });

  it("detects a sub-field change within the same metric type (sum.monotonic flip)", () => {
    const from = makeComponent({
      telemetry: {
        metrics: { "my.metric": makeMetric({ sum: { monotonic: true, value_type: "int" } }) },
      },
    });
    const to = makeComponent({
      telemetry: {
        metrics: { "my.metric": makeMetric({ sum: { monotonic: false, value_type: "int" } }) },
      },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].status).toBe("changed");
    expect(result.metrics[0].changes?.metricType).toEqual({ before: "sum", after: "sum" });
  });

  it("detects a histogram bucket_boundaries change", () => {
    const from = makeComponent({
      telemetry: {
        metrics: {
          "my.metric": makeMetric({
            sum: undefined,
            histogram: { value_type: "int", bucket_boundaries: [1, 2, 3] },
          }),
        },
      },
    });
    const to = makeComponent({
      telemetry: {
        metrics: {
          "my.metric": makeMetric({
            sum: undefined,
            histogram: { value_type: "int", bucket_boundaries: [1, 2, 3, 4] },
          }),
        },
      },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].status).toBe("changed");
    expect(result.metrics[0].changes?.metricType?.before).toBe("histogram");
  });

  it("detects an added attribute, resolving definitions from each version's own attributes map", () => {
    const from = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ attributes: [] }) } },
      attributes: {},
    });
    const to = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ attributes: ["outcome"] }) } },
      attributes: { outcome: { description: "Result", type: "string" } },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].changes?.attributes.added).toEqual([
      { key: "outcome", definition: { description: "Result", type: "string" } },
    ]);
    expect(result.metrics[0].changes?.attributes.removed).toEqual([]);
    expect(result.metrics[0].changes?.attributes.changed).toEqual([]);
  });

  it("detects a removed attribute", () => {
    const from = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ attributes: ["outcome"] }) } },
      attributes: { outcome: { description: "Result", type: "string" } },
    });
    const to = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ attributes: [] }) } },
      attributes: {},
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].changes?.attributes.removed).toEqual([
      { key: "outcome", definition: { description: "Result", type: "string" } },
    ]);
  });

  it("detects a changed attribute when the same key's resolved definition differs between versions", () => {
    const from = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ attributes: ["outcome"] }) } },
      attributes: { outcome: { description: "Result", type: "string" } },
    });
    const to = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ attributes: ["outcome"] }) } },
      attributes: { outcome: { description: "Result", type: "int" } },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].changes?.attributes.changed).toEqual([
      {
        key: "outcome",
        before: { description: "Result", type: "string" },
        after: { description: "Result", type: "int" },
      },
    ]);
  });

  it("handles a metric with attributes: undefined the same as attributes: [] without throwing or reporting spurious changes", () => {
    const from = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ attributes: undefined }) } },
    });
    const to = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ attributes: [] }) } },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].status).toBe("unchanged");
  });

  it("handles an attribute key with no resolvable definition on either side without throwing", () => {
    const from = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ attributes: ["missing"] }) } },
      attributes: {},
    });
    const to = makeComponent({
      telemetry: { metrics: { "my.metric": makeMetric({ attributes: ["missing"] }) } },
      attributes: {},
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics[0].status).toBe("unchanged");
  });

  it("supports multiple metric types present simultaneously without cross-type interference", () => {
    const from = makeComponent({
      telemetry: {
        metrics: {
          "sum.metric": makeMetric({ sum: { monotonic: true, value_type: "int" } }),
          "gauge.metric": makeMetric({ sum: undefined, gauge: { value_type: "double" } }),
          "histogram.metric": makeMetric({
            sum: undefined,
            histogram: { value_type: "int", bucket_boundaries: [1, 2] },
          }),
        },
      },
    });
    const to = makeComponent({
      telemetry: {
        metrics: {
          "sum.metric": makeMetric({ sum: { monotonic: true, value_type: "int" } }),
          "gauge.metric": makeMetric({ sum: undefined, gauge: { value_type: "double" } }),
          "histogram.metric": makeMetric({
            sum: undefined,
            histogram: { value_type: "int", bucket_boundaries: [1, 2] },
          }),
        },
      },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics.every((m) => m.status === "unchanged")).toBe(true);
    expect(result.metrics).toHaveLength(3);
  });

  it("produces deterministic, alphabetically sorted output regardless of input key order", () => {
    const from = makeComponent({
      telemetry: {
        metrics: {
          zeta: makeMetric(),
          alpha: makeMetric(),
          mu: makeMetric(),
        },
      },
    });
    const to = makeComponent({
      telemetry: {
        metrics: {
          mu: makeMetric(),
          zeta: makeMetric(),
          alpha: makeMetric(),
          beta: makeMetric({ description: "added" }),
        },
      },
    });
    const result = compareCollectorTelemetry(from, to);
    expect(result.metrics.map((m) => m.name)).toEqual(["alpha", "beta", "mu", "zeta"]);
  });
});
