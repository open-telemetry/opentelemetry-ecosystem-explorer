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
import { compareTelemetryMetrics } from "./telemetry-diff";
import type { CollectorComponent, CollectorMetric } from "@/types/collector";

function makeMetric(overrides: Partial<CollectorMetric> = {}): CollectorMetric {
  return {
    description: "A test metric",
    enabled: true,
    unit: "{span}",
    sum: { value_type: "int", monotonic: true },
    ...overrides,
  };
}

function makeComponent(telemetryMetrics?: Record<string, CollectorMetric>): CollectorComponent {
  return {
    id: "core-memorylimiterprocessor",
    name: "memorylimiterprocessor",
    ecosystem: "collector",
    type: "processor",
    distribution: "core",
    ...(telemetryMetrics ? { telemetry: { metrics: telemetryMetrics } } : {}),
  };
}

describe("compareTelemetryMetrics", () => {
  it("reports no diffs when telemetry is identical between versions", () => {
    const metric = makeMetric();
    const from = makeComponent({ "processor.refused_spans": metric });
    const to = makeComponent({ "processor.refused_spans": { ...metric } });

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics).toEqual([
      {
        status: "unchanged",
        name: "processor.refused_spans",
        metric: to.telemetry!.metrics!["processor.refused_spans"],
      },
    ]);
  });

  it("reports a metric present only in the target version as added", () => {
    const from = makeComponent({});
    const to = makeComponent({ "processor.new_metric": makeMetric() });

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0]).toMatchObject({ status: "added", name: "processor.new_metric" });
  });

  it("reports a metric present only in the base version as removed", () => {
    const from = makeComponent({ "processor.old_metric": makeMetric() });
    const to = makeComponent({});

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0]).toMatchObject({ status: "removed", name: "processor.old_metric" });
  });

  it("detects a description change", () => {
    const from = makeComponent({ "processor.metric": makeMetric({ description: "Old desc" }) });
    const to = makeComponent({ "processor.metric": makeMetric({ description: "New desc" }) });

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics[0].status).toBe("changed");
    expect(result.metrics[0].changes?.description).toEqual({
      before: "Old desc",
      after: "New desc",
    });
  });

  it("detects a unit change", () => {
    const from = makeComponent({ "processor.metric": makeMetric({ unit: "ms" }) });
    const to = makeComponent({ "processor.metric": makeMetric({ unit: "s" }) });

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics[0].changes?.unit).toEqual({ before: "ms", after: "s" });
  });

  it("detects an enabled/opt-in change", () => {
    const from = makeComponent({ "processor.metric": makeMetric({ enabled: false }) });
    const to = makeComponent({ "processor.metric": makeMetric({ enabled: true }) });

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics[0].changes?.enabled).toEqual({ before: false, after: true });
  });

  it("detects a stability change", () => {
    const from = makeComponent({ "processor.metric": makeMetric({ stability: "alpha" }) });
    const to = makeComponent({ "processor.metric": makeMetric({ stability: "beta" }) });

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics[0].changes?.stability).toEqual({ before: "alpha", after: "beta" });
  });

  it("detects an instrument type change (sum -> gauge)", () => {
    const from = makeComponent({
      "processor.metric": makeMetric({
        sum: { value_type: "int", monotonic: true },
        gauge: undefined,
      }),
    });
    const to = makeComponent({
      "processor.metric": makeMetric({ sum: undefined, gauge: { value_type: "int" } }),
    });

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics[0].changes?.type).toEqual({ before: "sum", after: "gauge" });
  });

  it("detects added and removed attribute keys on the same metric", () => {
    const from = makeComponent({
      "processor.metric": makeMetric({ attributes: ["exporter", "success"] }),
    });
    const to = makeComponent({
      "processor.metric": makeMetric({ attributes: ["success", "data_type"] }),
    });

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics[0].changes?.attributes).toEqual({
      added: ["data_type"],
      removed: ["exporter"],
    });
  });

  it("handles multiple metrics at once, each independently classified", () => {
    const from = makeComponent({
      "processor.unchanged": makeMetric(),
      "processor.removed": makeMetric(),
      "processor.changed": makeMetric({ description: "before" }),
    });
    const to = makeComponent({
      "processor.unchanged": makeMetric(),
      "processor.changed": makeMetric({ description: "after" }),
      "processor.added": makeMetric(),
    });

    const result = compareTelemetryMetrics(from, to);
    const byName = Object.fromEntries(result.metrics.map((m) => [m.name, m.status]));

    expect(byName).toEqual({
      "processor.unchanged": "unchanged",
      "processor.removed": "removed",
      "processor.changed": "changed",
      "processor.added": "added",
    });
  });

  it("returns an empty diff when neither version has telemetry", () => {
    const from = makeComponent();
    const to = makeComponent();

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics).toEqual([]);
  });

  it("treats a component with no telemetry.metrics field the same as one with an empty map", () => {
    const from = makeComponent();
    const to = makeComponent({ "processor.new": makeMetric() });

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics).toEqual([
      { status: "added", name: "processor.new", metric: to.telemetry!.metrics!["processor.new"] },
    ]);
  });

  it("treats a null component (failed to load) as having no telemetry, reporting all of the other side as added", () => {
    const to = makeComponent({ "processor.a": makeMetric(), "processor.b": makeMetric() });

    const result = compareTelemetryMetrics(null, to);

    expect(result.metrics.map((m) => m.status)).toEqual(["added", "added"]);
  });

  it("treats a null component (failed to load) as having no telemetry, reporting all of the other side as removed", () => {
    const from = makeComponent({ "processor.a": makeMetric(), "processor.b": makeMetric() });

    const result = compareTelemetryMetrics(from, null);

    expect(result.metrics.map((m) => m.status)).toEqual(["removed", "removed"]);
  });

  it("returns an empty diff when both components are null", () => {
    const result = compareTelemetryMetrics(null, null);
    expect(result.metrics).toEqual([]);
  });

  it("does not flag a change when attributes are the same set in a different order", () => {
    const from = makeComponent({ "processor.metric": makeMetric({ attributes: ["a", "b"] }) });
    const to = makeComponent({ "processor.metric": makeMetric({ attributes: ["b", "a"] }) });

    const result = compareTelemetryMetrics(from, to);

    expect(result.metrics[0].status).toBe("unchanged");
  });
});
