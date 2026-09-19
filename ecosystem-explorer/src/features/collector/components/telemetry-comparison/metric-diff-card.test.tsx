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

  it("renders an extendedDocumentation-only change, not a blank Changed card", () => {
    // Regression guard: extendedDocumentation is part of CollectorMetricChanges but was
    // never rendered, so a Changed card could have no visible change at all.
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({ extended_documentation: "after" }),
      changes: {
        extendedDocumentation: { before: "before", after: "after" },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("Extended documentation changed")).toBeInTheDocument();
    expect(screen.getByText("before")).toBeInTheDocument();
    expect(screen.getByText("after")).toBeInTheDocument();
  });

  it("renders an optional-only change, not a blank Changed card", () => {
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({ optional: true }),
      changes: {
        optional: { before: false, after: true },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("Optional state changed")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("renders a prefix-only change, not a blank Changed card", () => {
    // Jay: prefix participates in the exported metric name, so it must be a visible change.
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({ prefix: "otelcol.v2." }),
      changes: {
        prefix: { before: "otelcol.", after: "otelcol.v2." },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("Prefix changed")).toBeInTheDocument();
    expect(screen.getByText("otelcol.")).toBeInTheDocument();
    expect(screen.getByText("otelcol.v2.")).toBeInTheDocument();
  });

  it("renders a deprecated-only change (becoming deprecated), not a blank Changed card", () => {
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({
        deprecated: { note: "Use my.other.metric instead", since: "0.150.0" },
      }),
      changes: {
        deprecated: {
          before: undefined,
          after: { note: "Use my.other.metric instead", since: "0.150.0" },
        },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("Deprecation changed")).toBeInTheDocument();
    expect(screen.getByText("Not deprecated")).toBeInTheDocument();
    expect(screen.getByText("Use my.other.metric instead")).toBeInTheDocument();
  });

  it("renders a deprecated-only change (note updated) without a fallback placeholder", () => {
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({ deprecated: { note: "new note", since: "0.150.0" } }),
      changes: {
        deprecated: {
          before: { note: "old note", since: "0.140.0" },
          after: { note: "new note", since: "0.150.0" },
        },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("old note")).toBeInTheDocument();
    expect(screen.getByText("new note")).toBeInTheDocument();
    expect(screen.queryByText("Deprecated")).not.toBeInTheDocument();
  });

  it("renders a warnings-only change (single field), not a blank Changed card", () => {
    // Regression guard: warnings is part of CollectorMetricChanges but was never rendered,
    // so a warnings-only Changed card had no visible change at all.
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({
        warnings: { if_enabled: "This metric is deprecated and will be removed soon." },
      }),
      changes: {
        warnings: {
          before: undefined,
          after: { if_enabled: "This metric is deprecated and will be removed soon." },
        },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("Warnings changed")).toBeInTheDocument();
    expect(screen.getByText("If enabled:")).toBeInTheDocument();
    expect(
      screen.getByText("This metric is deprecated and will be removed soon.")
    ).toBeInTheDocument();
    // Only the field that actually differs is rendered.
    expect(screen.queryByText("If configured:")).not.toBeInTheDocument();
    expect(screen.queryByText("If enabled not set:")).not.toBeInTheDocument();
  });

  it("renders each changed warnings field when more than one differs", () => {
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({
        warnings: { if_enabled: "new if_enabled", if_configured: "new if_configured" },
      }),
      changes: {
        warnings: {
          before: { if_enabled: "old if_enabled", if_configured: "old if_configured" },
          after: { if_enabled: "new if_enabled", if_configured: "new if_configured" },
        },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("old if_enabled")).toBeInTheDocument();
    expect(screen.getByText("new if_enabled")).toBeInTheDocument();
    expect(screen.getByText("old if_configured")).toBeInTheDocument();
    expect(screen.getByText("new if_configured")).toBeInTheDocument();
  });

  it("renders a warning key not modeled in CollectorMetricWarnings, with a readable fallback label and its before/after values", () => {
    // Regression guard: telemetry-diff.ts's warningsEqual() compares the union of keys
    // actually present, so a future upstream warning field must still be visible here, not
    // just collapsed into an unhelpful "Warnings changed" with no row.
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric(),
      changes: {
        warnings: {
          before: { if_enabled: "same" } as never,
          after: {
            if_enabled: "same",
            if_future_condition: "a warning field not yet modeled in the frontend",
          } as never,
        },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("Warnings changed")).toBeInTheDocument();
    // Readable fallback label derived from the raw key, not the raw snake_case key itself.
    expect(screen.getByText("If future condition:")).toBeInTheDocument();
    expect(screen.getByText("a warning field not yet modeled in the frontend")).toBeInTheDocument();
    // The unchanged known field must not render a row.
    expect(screen.queryByText("If enabled:")).not.toBeInTheDocument();
  });

  it("renders an added unmodeled warning key with a '—' placeholder for the missing before value", () => {
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric(),
      changes: {
        warnings: {
          before: undefined,
          after: { some_future_warning_key: "newly added warning" } as never,
        },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("Some future warning key:")).toBeInTheDocument();
    expect(screen.getByText("newly added warning")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a removed unmodeled warning key with a '—' placeholder for the missing after value", () => {
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric(),
      changes: {
        warnings: {
          before: { some_future_warning_key: "going away" } as never,
          after: undefined,
        },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    render(<MetricDiffCard diff={diff} />);
    expect(screen.getByText("Some future warning key:")).toBeInTheDocument();
    expect(screen.getByText("going away")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("does not render the warnings section at all when there is no warnings change", () => {
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
    expect(screen.queryByText("Warnings changed")).not.toBeInTheDocument();
  });

  it("renders the unit change through i18n interpolation, not hardcoded English", () => {
    const diff: CollectorMetricDiff = {
      status: "changed",
      name: "my.metric",
      metric: makeMetric({ unit: "s" }),
      changes: {
        unit: { before: "ms", after: "s" },
        attributes: { added: [], removed: [], changed: [] },
      },
    };
    const { container } = render(<MetricDiffCard diff={diff} />);
    // The old unit value must be rendered as its own styled element via translation
    // interpolation (Trans), not concatenated into a hardcoded, non-translatable string.
    const oldUnitChip = screen.getByText("ms");
    expect(oldUnitChip.tagName).toBe("CODE");
    expect(container.textContent).toContain("(was: ms)");
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
