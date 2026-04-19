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
import { compareTelemetry } from "./telemetry-diff";
import type { InstrumentationData, Metric, Span, Attribute } from "@/types/javaagent";

function makeInstrumentation(
  metrics?: Metric[],
  spans?: Span[]
): InstrumentationData {
  return {
    name: "test-instrumentation",
    scope: { name: "test" },
    telemetry: [{ when: "default", metrics, spans }],
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
    const metric: Metric = { name: "http.duration", description: "desc", instrument: "histogram", data_type: "HISTOGRAM", unit: "ms" };
    const comparison = makeInstrumentation([metric]);
    const result = compareTelemetry(null, comparison);
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].status).toBe("added");
    expect(result.metrics[0].metric).toEqual(metric);
  });

  it("marks all metrics as removed when comparison is null", () => {
    const metric: Metric = { name: "http.duration", description: "desc", instrument: "histogram", data_type: "HISTOGRAM", unit: "ms" };
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
      instrument: "histogram", data_type: "HISTOGRAM",
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
    const existing: Metric = { name: "existing", description: "d", instrument: "counter", data_type: "COUNTER", unit: "1" };
    const added: Metric = { name: "new.metric", description: "d2", instrument: "gauge", data_type: "LONG_GAUGE", unit: "s" };
    const base = makeInstrumentation([existing]);
    const comparison = makeInstrumentation([existing, added]);
    const result = compareTelemetry(base, comparison);
    const addedDiff = result.metrics.find((m) => m.status === "added");
    expect(addedDiff).toBeDefined();
    expect(addedDiff?.metric.name).toBe("new.metric");
  });

  it("detects removed metric", () => {
    const existing: Metric = { name: "existing", description: "d", instrument: "counter", data_type: "COUNTER", unit: "1" };
    const removed: Metric = { name: "old.metric", description: "d2", instrument: "gauge", data_type: "LONG_GAUGE", unit: "s" };
    const base = makeInstrumentation([existing, removed]);
    const comparison = makeInstrumentation([existing]);
    const result = compareTelemetry(base, comparison);
    const removedDiff = result.metrics.find((m) => m.status === "removed");
    expect(removedDiff).toBeDefined();
    expect(removedDiff?.metric.name).toBe("old.metric");
  });

  it("detects changed metric description", () => {
    const base = makeInstrumentation([
      { name: "m", description: "old desc", instrument: "counter", data_type: "COUNTER", unit: "1" },
    ]);
    const comparison = makeInstrumentation([
      { name: "m", description: "new desc", instrument: "counter", data_type: "COUNTER", unit: "1" },
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
      { name: "m", description: "d", instrument: "counter", data_type: "COUNTER", unit: "1", attributes: [attrString("a")] },
    ]);
    const comparison = makeInstrumentation([
      {
        name: "m",
        description: "d",
        instrument: "counter", data_type: "COUNTER",
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
        instrument: "counter", data_type: "COUNTER",
        unit: "1",
        attributes: [attrString("a"), attrString("b")],
      },
    ]);
    const comparison = makeInstrumentation([
      { name: "m", description: "d", instrument: "counter", data_type: "COUNTER", unit: "1", attributes: [attrString("a")] },
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
