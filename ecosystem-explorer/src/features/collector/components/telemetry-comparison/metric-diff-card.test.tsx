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
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MetricDiffCard } from "./metric-diff-card";
import type { CollectorMetric, CollectorMetricDiff } from "@/types/collector";

function makeMetric(overrides: Partial<CollectorMetric> = {}): CollectorMetric {
  return {
    description: "A test metric",
    enabled: true,
    unit: "1",
    sum: { monotonic: true, value_type: "int" },
    ...overrides,
  };
}

describe("MetricDiffCard", () => {
  it("does not render the Attribute Changes section when changes.attributes has no added/removed/changed entries", () => {
    // Regression guard: `changes.attributes` is always constructed (non-optional), so a
    // truthiness check alone would show this section for every changed metric.
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({ description: "after" }),
      changes: {
        description: { before: "before", after: "after" },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.queryByText("Attribute Changes")).not.toBeInTheDocument();
  });

  it("renders the Attribute Changes section when there is at least one added/removed/changed attribute", () => {
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric(),
      changes: {
        attributes: {
          added: [{ key: "outcome", definition: { description: "Result", type: "string" } }],
          removed: [],
          changed: [],
        },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("Attribute Changes")).toBeInTheDocument();
  });

  it("does not render a metricType row for a same-type descriptor change", () => {
    // Regression guard: a monotonic-only flip within "sum" must never render as
    // "Metric type changed: sum -> sum".
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({ sum: { monotonic: false, value_type: "int" } }),
      changes: {
        descriptor: { monotonic: { before: true, after: false } },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.queryByText("Metric type changed")).not.toBeInTheDocument();
    expect(screen.getByText("Descriptor changed")).toBeInTheDocument();
    expect(screen.getByText("Monotonic:")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  it("renders bucket_boundaries as a formatted list in the descriptor change", () => {
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({
        sum: undefined,
        histogram: { value_type: "int", bucket_boundaries: [1, 2, 3, 4] },
      }),
      changes: {
        descriptor: { bucket_boundaries: { before: [1, 2, 3], after: [1, 2, 3, 4] } },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("[1, 2, 3]")).toBeInTheDocument();
    expect(screen.getByText("[1, 2, 3, 4]")).toBeInTheDocument();
  });

  it("still renders the metricType row for a true instrument type change", () => {
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({ sum: undefined, gauge: { value_type: "int" } }),
      changes: {
        metricType: { before: "sum", after: "gauge" },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("Metric type changed")).toBeInTheDocument();
    expect(screen.getByText("sum")).toBeInTheDocument();
    expect(screen.getByText("gauge")).toBeInTheDocument();
  });
});
