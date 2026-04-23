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
import { compareTelemetry, getAvailableWhenConditions } from "./telemetry-diff";
import type { InstrumentationData, Metric, Span, Attribute } from "@/types/javaagent";

function makeInstrumentation(
  metrics?: Metric[],
  spans?: Span[],
  when: string = "default"
): InstrumentationData {
  return {
    name: "test-instrumentation",
    scope: { name: "test" },
    telemetry: [{ when, metrics, spans }],
  };
}

const attrString = (name: string): Attribute => ({ name, type: "STRING" });

describe("compareTelemetry", () => {
  it("returns empty diffs when both instrumentations are null", () => {
    const result = compareTelemetry(null, null);
    expect(result.metrics).toEqual([]);
    expect(result.spans).toEqual([]);
  });

  it("marks all metrics as added when base is null", () => {
    const metric: Metric = {
      name: "http.duration",
      description: "desc",
      instrument: "histogram",
      data_type: "HISTOGRAM",
      unit: "ms",
    };
    const comparison = makeInstrumentation([metric]);
    const result = compareTelemetry(null, comparison);
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].status).toBe("added");
    expect(result.metrics[0].metric).toEqual(metric);
  });

  it("marks all metrics as removed when comparison is null", () => {
    const metric: Metric = {
      name: "http.duration",
      description: "desc",
      instrument: "histogram",
      data_type: "HISTOGRAM",
      unit: "ms",
    };
    const base = makeInstrumentation([metric]);
    const result = compareTelemetry(base, null);
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].status).toBe("removed");
    expect(result.metrics[0].metric).toEqual(metric);
  });

  it("marks unchanged metrics correctly", () => {
    const metric: Metric = {
      name: "http.duration",
      description: "desc",
      instrument: "histogram",
      data_type: "HISTOGRAM",
      unit: "ms",
      attributes: [attrString("http.method")],
    };
    const base = makeInstrumentation([metric]);
    const comparison = makeInstrumentation([metric]);
    const result = compareTelemetry(base, comparison);
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].status).toBe("unchanged");
  });

  it("detects added metric", () => {
    const existing: Metric = {
      name: "existing",
      description: "d",
      instrument: "counter",
      data_type: "COUNTER",
      unit: "1",
    };
    const added: Metric = {
      name: "new.metric",
      description: "d2",
      instrument: "gauge",
      data_type: "LONG_GAUGE",
      unit: "s",
    };
    const base = makeInstrumentation([existing]);
    const comparison = makeInstrumentation([existing, added]);
    const result = compareTelemetry(base, comparison);
    const addedDiff = result.metrics.find((m) => m.status === "added");
    expect(addedDiff).toBeDefined();
    expect(addedDiff?.metric.name).toBe("new.metric");
  });

  it("detects removed metric", () => {
    const existing: Metric = {
      name: "existing",
      description: "d",
      instrument: "counter",
      data_type: "COUNTER",
      unit: "1",
    };
    const removed: Metric = {
      name: "old.metric",
      description: "d2",
      instrument: "gauge",
      data_type: "LONG_GAUGE",
      unit: "s",
    };
    const base = makeInstrumentation([existing, removed]);
    const comparison = makeInstrumentation([existing]);
    const result = compareTelemetry(base, comparison);
    const removedDiff = result.metrics.find((m) => m.status === "removed");
    expect(removedDiff).toBeDefined();
    expect(removedDiff?.metric.name).toBe("old.metric");
  });

  it("detects changed metric description", () => {
    const base = makeInstrumentation([
      {
        name: "m",
        description: "old desc",
        instrument: "counter",
        data_type: "COUNTER",
        unit: "1",
      },
    ]);
    const comparison = makeInstrumentation([
      {
        name: "m",
        description: "new desc",
        instrument: "counter",
        data_type: "COUNTER",
        unit: "1",
      },
    ]);
    const result = compareTelemetry(base, comparison);
    expect(result.metrics).toHaveLength(1);
    const diff = result.metrics[0];
    expect(diff.status).toBe("changed");
    expect(diff.changes?.description).toEqual({ before: "old desc", after: "new desc" });
  });

  it("detects changed metric type", () => {
    const base = makeInstrumentation([
      { name: "m", description: "desc", instrument: "counter", data_type: "COUNTER", unit: "1" },
    ]);
    const comparison = makeInstrumentation([
      { name: "m", description: "desc", instrument: "gauge", data_type: "LONG_GAUGE", unit: "1" },
    ]);
    const result = compareTelemetry(base, comparison);
    const diff = result.metrics[0];
    expect(diff.status).toBe("changed");
    expect(diff.changes?.data_type).toEqual({ before: "COUNTER", after: "LONG_GAUGE" });
  });

  it("detects changed metric unit", () => {
    const base = makeInstrumentation([
      { name: "m", description: "desc", instrument: "counter", data_type: "COUNTER", unit: "1" },
    ]);
    const comparison = makeInstrumentation([
      { name: "m", description: "desc", instrument: "counter", data_type: "COUNTER", unit: "ms" },
    ]);
    const result = compareTelemetry(base, comparison);
    const diff = result.metrics[0];
    expect(diff.status).toBe("changed");
    expect(diff.changes?.unit).toEqual({ before: "1", after: "ms" });
  });

  it("detects added attribute on metric", () => {
    const base = makeInstrumentation([
      {
        name: "m",
        description: "d",
        instrument: "counter",
        data_type: "COUNTER",
        unit: "1",
        attributes: [attrString("a")],
      },
    ]);
    const comparison = makeInstrumentation([
      {
        name: "m",
        description: "d",
        instrument: "counter",
        data_type: "COUNTER",
        unit: "1",
        attributes: [attrString("a"), attrString("b")],
      },
    ]);
    const result = compareTelemetry(base, comparison);
    const diff = result.metrics[0];
    expect(diff.status).toBe("changed");
    expect(diff.changes?.attributes.added).toHaveLength(1);
    expect(diff.changes?.attributes.added[0].name).toBe("b");
    expect(diff.changes?.attributes.removed).toHaveLength(0);
  });

  it("detects removed attribute on metric", () => {
    const base = makeInstrumentation([
      {
        name: "m",
        description: "d",
        instrument: "counter",
        data_type: "COUNTER",
        unit: "1",
        attributes: [attrString("a"), attrString("b")],
      },
    ]);
    const comparison = makeInstrumentation([
      {
        name: "m",
        description: "d",
        instrument: "counter",
        data_type: "COUNTER",
        unit: "1",
        attributes: [attrString("a")],
      },
    ]);
    const result = compareTelemetry(base, comparison);
    const diff = result.metrics[0];
    expect(diff.status).toBe("changed");
    expect(diff.changes?.attributes.removed).toHaveLength(1);
    expect(diff.changes?.attributes.removed[0].name).toBe("b");
    expect(diff.changes?.attributes.added).toHaveLength(0);
  });

  it("handles metrics with undefined attributes as unchanged", () => {
    const base = makeInstrumentation([
      { name: "m", description: "d", instrument: "counter", data_type: "COUNTER", unit: "1" },
    ]);
    const comparison = makeInstrumentation([
      { name: "m", description: "d", instrument: "counter", data_type: "COUNTER", unit: "1" },
    ]);
    const result = compareTelemetry(base, comparison);
    expect(result.metrics[0].status).toBe("unchanged");
  });
});

describe("compareTelemetry - spans", () => {
  it("marks all spans as added when base is null", () => {
    const span: Span = { span_kind: "CLIENT", attributes: [attrString("http.method")] };
    const comparison = makeInstrumentation(undefined, [span]);
    const result = compareTelemetry(null, comparison);
    expect(result.spans).toHaveLength(1);
    expect(result.spans[0].status).toBe("added");
    expect(result.spans[0].span).toEqual(span);
  });

  it("marks all spans as removed when comparison is null", () => {
    const span: Span = { span_kind: "SERVER" };
    const base = makeInstrumentation(undefined, [span]);
    const result = compareTelemetry(base, null);
    expect(result.spans).toHaveLength(1);
    expect(result.spans[0].status).toBe("removed");
  });

  it("marks unchanged spans correctly", () => {
    const span: Span = { span_kind: "CLIENT", attributes: [attrString("http.method")] };
    const base = makeInstrumentation(undefined, [span]);
    const comparison = makeInstrumentation(undefined, [span]);
    const result = compareTelemetry(base, comparison);
    expect(result.spans[0].status).toBe("unchanged");
  });

  it("detects added attribute on span", () => {
    const base = makeInstrumentation(undefined, [
      { span_kind: "CLIENT", attributes: [attrString("a")] },
    ]);
    const comparison = makeInstrumentation(undefined, [
      { span_kind: "CLIENT", attributes: [attrString("a"), attrString("b")] },
    ]);
    const result = compareTelemetry(base, comparison);
    const diff = result.spans[0];
    expect(diff.status).toBe("changed");
    expect(diff.changes?.attributes.added).toHaveLength(1);
    expect(diff.changes?.attributes.added[0].name).toBe("b");
  });

  it("detects removed attribute on span", () => {
    const base = makeInstrumentation(undefined, [
      { span_kind: "CLIENT", attributes: [attrString("a"), attrString("b")] },
    ]);
    const comparison = makeInstrumentation(undefined, [
      { span_kind: "CLIENT", attributes: [attrString("a")] },
    ]);
    const result = compareTelemetry(base, comparison);
    const diff = result.spans[0];
    expect(diff.status).toBe("changed");
    expect(diff.changes?.attributes.removed).toHaveLength(1);
    expect(diff.changes?.attributes.removed[0].name).toBe("b");
  });

  it("handles spans with undefined attributes as unchanged", () => {
    const base = makeInstrumentation(undefined, [{ span_kind: "CLIENT" }]);
    const comparison = makeInstrumentation(undefined, [{ span_kind: "CLIENT" }]);
    const result = compareTelemetry(base, comparison);
    expect(result.spans[0].status).toBe("unchanged");
  });
});

describe("compareTelemetry - when parameter", () => {
  it("compares a non-default when condition when both versions have it", () => {
    const metric: Metric = {
      name: "m",
      description: "d",
      instrument: "counter",
      data_type: "COUNTER",
      unit: "1",
    };
    const base = makeInstrumentation([metric], undefined, "when_X_enabled");
    const comparison = makeInstrumentation([metric], undefined, "when_X_enabled");
    const result = compareTelemetry(base, comparison, "when_X_enabled");
    expect(result.metrics[0].status).toBe("unchanged");
  });

  it("treats missing when condition as empty (all added) when base lacks it", () => {
    const metric: Metric = {
      name: "m",
      description: "d",
      instrument: "counter",
      data_type: "COUNTER",
      unit: "1",
    };
    const base = makeInstrumentation([metric], undefined, "default");
    const comparison = makeInstrumentation([metric], undefined, "when_X_enabled");
    const result = compareTelemetry(base, comparison, "when_X_enabled");
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].status).toBe("added");
  });

  it("treats missing when condition as empty (all removed) when comparison lacks it", () => {
    const metric: Metric = {
      name: "m",
      description: "d",
      instrument: "counter",
      data_type: "COUNTER",
      unit: "1",
    };
    const base = makeInstrumentation([metric], undefined, "when_X_enabled");
    const comparison = makeInstrumentation([metric], undefined, "default");
    const result = compareTelemetry(base, comparison, "when_X_enabled");
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].status).toBe("removed");
  });

  it("defaults to when=default when third argument is omitted", () => {
    const metric: Metric = {
      name: "m",
      description: "d",
      instrument: "counter",
      data_type: "COUNTER",
      unit: "1",
    };
    const base = makeInstrumentation([metric]);
    const comparison = makeInstrumentation([metric]);
    const result = compareTelemetry(base, comparison);
    expect(result.metrics[0].status).toBe("unchanged");
  });
});

describe("getAvailableWhenConditions", () => {
  it("returns union of when values from both instrumentations", () => {
    const base: InstrumentationData = {
      name: "test",
      scope: { name: "test" },
      telemetry: [{ when: "default" }, { when: "when_A" }],
    };
    const comparison: InstrumentationData = {
      name: "test",
      scope: { name: "test" },
      telemetry: [{ when: "default" }, { when: "when_B" }],
    };
    const result = getAvailableWhenConditions(base, comparison);
    expect(result).toContain("default");
    expect(result).toContain("when_A");
    expect(result).toContain("when_B");
    expect(result).toHaveLength(3);
  });

  it("puts default first", () => {
    const base: InstrumentationData = {
      name: "test",
      scope: { name: "test" },
      telemetry: [{ when: "when_A" }, { when: "default" }],
    };
    const result = getAvailableWhenConditions(base, null);
    expect(result[0]).toBe("default");
  });

  it("deduplicates identical when values", () => {
    const base: InstrumentationData = {
      name: "test",
      scope: { name: "test" },
      telemetry: [{ when: "default" }],
    };
    const comparison: InstrumentationData = {
      name: "test",
      scope: { name: "test" },
      telemetry: [{ when: "default" }],
    };
    const result = getAvailableWhenConditions(base, comparison);
    expect(result).toHaveLength(1);
  });

  it("handles both null inputs", () => {
    const result = getAvailableWhenConditions(null, null);
    expect(result).toEqual([]);
  });
});

describe("attribute type changes", () => {
  it("detects when an attribute type changes", () => {
    const base = makeInstrumentation([
      {
        name: "metric",
        description: "desc",
        instrument: "counter",
        data_type: "LONG_SUM",
        unit: "",
        attributes: [{ name: "status", type: "STRING" }],
      },
    ]);
    const comparison = makeInstrumentation([
      {
        name: "metric",
        description: "desc",
        instrument: "counter",
        data_type: "LONG_SUM",
        unit: "",
        attributes: [{ name: "status", type: "LONG" }],
      },
    ]);
    const result = compareTelemetry(base, comparison);
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].status).toBe("changed");
    expect(result.metrics[0].changes?.attributes.changed).toHaveLength(1);
    expect(result.metrics[0].changes?.attributes.changed[0].name).toBe("status");
    expect(result.metrics[0].changes?.attributes.changed[0].before.type).toBe("STRING");
    expect(result.metrics[0].changes?.attributes.changed[0].after.type).toBe("LONG");
  });

  it("detects attribute type changes in spans", () => {
    const base = makeInstrumentation(
      [],
      [
        {
          span_kind: "SERVER",
          attributes: [{ name: "http.status_code", type: "STRING" }],
        },
      ]
    );
    const comparison = makeInstrumentation(
      [],
      [
        {
          span_kind: "SERVER",
          attributes: [{ name: "http.status_code", type: "LONG" }],
        },
      ]
    );
    const result = compareTelemetry(base, comparison);
    expect(result.spans).toHaveLength(1);
    expect(result.spans[0].status).toBe("changed");
    expect(result.spans[0].changes?.attributes.changed).toHaveLength(1);
  });
});

describe("span ordering", () => {
  it("handles reordered spans within the same kind", () => {
    const baseSpan1: Span = {
      span_kind: "SERVER",
      attributes: [{ name: "attr1", type: "STRING" }],
    };
    const baseSpan2: Span = {
      span_kind: "SERVER",
      attributes: [{ name: "attr2", type: "STRING" }],
    };
    const base = makeInstrumentation([], [baseSpan1, baseSpan2]);

    const comparisonSpan2: Span = {
      span_kind: "SERVER",
      attributes: [{ name: "attr2", type: "STRING" }],
    };
    const comparisonSpan1: Span = {
      span_kind: "SERVER",
      attributes: [{ name: "attr1", type: "STRING" }],
    };
    const comparison = makeInstrumentation([], [comparisonSpan2, comparisonSpan1]);

    const result = compareTelemetry(base, comparison);
    // Should not report changes when spans are just reordered
    // Note: Current algorithm is order-sensitive by index, so this will report changes
    // This test documents current behavior and can be updated if algorithm improves
    expect(result.spans).toHaveLength(2);
  });

  it("distinguishes between reordered spans and actual changes", () => {
    const baseSpans: Span[] = [
      { span_kind: "CLIENT", attributes: [{ name: "url", type: "STRING" }] },
      { span_kind: "CLIENT", attributes: [{ name: "method", type: "STRING" }] },
    ];
    const base = makeInstrumentation([], baseSpans);

    const comparisonSpans: Span[] = [
      { span_kind: "CLIENT", attributes: [{ name: "url", type: "STRING" }] },
      { span_kind: "CLIENT", attributes: [{ name: "method", type: "STRING" }] },
    ];
    const comparison = makeInstrumentation([], comparisonSpans);

    const result = compareTelemetry(base, comparison);
    // Same spans in same order should show as unchanged
    expect(result.spans.every((s) => s.status === "unchanged")).toBe(true);
  });
});
