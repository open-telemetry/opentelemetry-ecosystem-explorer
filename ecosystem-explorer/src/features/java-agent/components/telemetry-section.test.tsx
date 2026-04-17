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
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TelemetrySection } from "./telemetry-section";
import type { Telemetry, Metric, Span, Attribute } from "@/types/javaagent";
import type { ReactNode } from "react";

vi.mock("./configuration-selector", () => ({
  ConfigurationSelector: ({
    telemetry,
    selectedWhen,
    onWhenChange,
  }: {
    telemetry: Telemetry[];
    selectedWhen: string;
    onWhenChange: (when: string) => void;
  }) => (
    <div data-testid="config-selector">
      <select
        data-testid="config-select"
        value={selectedWhen}
        onChange={(e) => onWhenChange(e.target.value)}
      >
        {telemetry.map((t) => (
          <option key={t.when} value={t.when}>
            {t.when}
          </option>
        ))}
      </select>
    </div>
  ),
}));

vi.mock("./attribute-table", () => ({
  AttributeTable: ({ attributes }: { attributes: Attribute[] }) => (
    <div data-testid="attribute-table">
      {attributes.map((attr) => (
        <div key={attr.name}>
          {attr.name}: {attr.type}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/ui/section-divider", () => ({
  SectionDivider: ({ children }: { children: ReactNode }) => (
    <div data-testid="section-divider">{children}</div>
  ),
}));

vi.mock("@/components/ui/glow-badge", () => ({
  GlowBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

describe("TelemetrySection", () => {
  const mockMetric: Metric = {
    name: "http.server.duration",
    description: "Duration of HTTP server requests",
    data_type: "HISTOGRAM",
    instrument: "histogram",
    unit: "ms",
    attributes: [
      { name: "http.method", type: "STRING" },
      { name: "http.status_code", type: "LONG" },
    ],
  };

  const mockSpan: Span = {
    span_kind: "CLIENT",
    attributes: [
      { name: "http.url", type: "STRING" },
      { name: "http.target", type: "STRING" },
    ],
  };

  describe("Configuration Selector", () => {
    it("does not render configuration selector when single configuration", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          metrics: [mockMetric],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(screen.queryByTestId("config-selector")).not.toBeInTheDocument();
    });

    it("renders configuration selector when multiple configurations", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          metrics: [mockMetric],
        },
        {
          when: "otel.instrumentation.http.enabled=true",
          metrics: [mockMetric],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(screen.getByTestId("config-selector")).toBeInTheDocument();
    });

    it("initializes with first configuration selected", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          metrics: [mockMetric],
        },
        {
          when: "custom",
          spans: [mockSpan],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      const select = screen.getByTestId("config-select") as HTMLSelectElement;
      expect(select.value).toBe("default");
    });

    it("switches between configurations when selection changes", async () => {
      const user = userEvent.setup();
      const defaultMetric: Metric = {
        name: "default.metric",
        description: "Default metric",
        data_type: "COUNTER",
        instrument: "counter",
        unit: "1",
      };

      const customMetric: Metric = {
        name: "custom.metric",
        description: "Custom metric",
        data_type: "COUNTER",
        instrument: "counter",
        unit: "ms",
      };

      const telemetry: Telemetry[] = [
        {
          when: "default",
          metrics: [defaultMetric],
        },
        {
          when: "custom",
          metrics: [customMetric],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      // Initially should show default metric
      expect(screen.getByText("default.metric")).toBeInTheDocument();
      expect(screen.queryByText("custom.metric")).not.toBeInTheDocument();

      // Switch to custom configuration
      const select = screen.getByTestId("config-select");
      await user.selectOptions(select, "custom");

      // Now should show custom metric
      expect(screen.queryByText("default.metric")).not.toBeInTheDocument();
      expect(screen.getByText("custom.metric")).toBeInTheDocument();
    });
  });

  describe("Metrics Rendering", () => {
    it("renders metrics section when metrics exist", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          metrics: [mockMetric],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(screen.getByTestId("section-divider")).toHaveTextContent("Metrics");
      expect(screen.getByText("http.server.duration")).toBeInTheDocument();
    });

    it("renders metric attributes when present", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          metrics: [mockMetric],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(screen.getByTestId("attribute-table")).toBeInTheDocument();
      expect(screen.getByText(/http\.method/)).toBeInTheDocument();
      expect(screen.getByText(/http\.status_code/)).toBeInTheDocument();
    });

    it("does not render attributes section when metric has no attributes", () => {
      const metricWithoutAttrs: Metric = {
        name: "simple.metric",
        description: "Simple metric",
        data_type: "COUNTER",
        instrument: "counter",
        unit: "1",
      };

      const telemetry: Telemetry[] = [
        {
          when: "default",
          metrics: [metricWithoutAttrs],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(screen.queryByTestId("attribute-table")).not.toBeInTheDocument();
    });

    it("does not render metrics section when no metrics", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          spans: [mockSpan],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      const dividers = screen.getAllByTestId("section-divider");
      const metricsSection = dividers.find((div) => div.textContent === "Metrics");

      expect(metricsSection).toBeUndefined();
    });
  });

  describe("Spans Rendering", () => {
    it("renders spans section when spans exist", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          spans: [mockSpan],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(screen.getByTestId("section-divider")).toHaveTextContent("Spans");
    });

    it("renders span kind", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          spans: [mockSpan],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(screen.getByText("CLIENT Span")).toBeInTheDocument();
    });

    it("renders span attributes when present", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          spans: [mockSpan],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(screen.getByTestId("attribute-table")).toBeInTheDocument();
      expect(screen.getByText(/http\.url/)).toBeInTheDocument();
      expect(screen.getByText(/http\.target/)).toBeInTheDocument();
    });

    it("does not render attributes section when span has no attributes", () => {
      const spanWithoutAttrs: Span = {
        span_kind: "INTERNAL",
      };

      const telemetry: Telemetry[] = [
        {
          when: "default",
          spans: [spanWithoutAttrs],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(screen.queryByTestId("attribute-table")).not.toBeInTheDocument();
    });

    it("does not render spans section when no spans", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          metrics: [mockMetric],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      const dividers = screen.getAllByTestId("section-divider");
      const spansSection = dividers.find((div) => div.textContent === "Spans");

      expect(spansSection).toBeUndefined();
    });
  });

  describe("Both Metrics and Spans", () => {
    it("renders both metrics and spans sections when both exist", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
          metrics: [mockMetric],
          spans: [mockSpan],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      const dividers = screen.getAllByTestId("section-divider");
      expect(dividers).toHaveLength(2);

      expect(dividers[0]).toHaveTextContent("Metrics");
      expect(dividers[1]).toHaveTextContent("Spans");

      expect(screen.getByText("http.server.duration")).toBeInTheDocument();
      expect(screen.getByText("CLIENT Span")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no metrics and no spans", () => {
      const telemetry: Telemetry[] = [
        {
          when: "default",
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(
        screen.getByText("No metrics or spans defined for this configuration.")
      ).toBeInTheDocument();
    });

    it("does not show empty state when telemetry exists", () => {
      const withMetrics: Telemetry[] = [{ when: "default", metrics: [mockMetric] }];
      const { unmount } = render(<TelemetrySection telemetry={withMetrics} />);
      expect(
        screen.queryByText("No metrics or spans defined for this configuration.")
      ).not.toBeInTheDocument();
      unmount();

      const withSpans: Telemetry[] = [{ when: "default", spans: [mockSpan] }];
      render(<TelemetrySection telemetry={withSpans} />);
      expect(
        screen.queryByText("No metrics or spans defined for this configuration.")
      ).not.toBeInTheDocument();
    });

    it("shows empty state for selected configuration with no telemetry", async () => {
      const user = userEvent.setup();
      const telemetry: Telemetry[] = [
        {
          when: "default",
          metrics: [mockMetric],
        },
        {
          when: "empty",
          metrics: [],
          spans: [],
        },
      ];

      render(<TelemetrySection telemetry={telemetry} />);

      // Initially shows default metric
      expect(screen.queryByText("No metrics or spans defined")).not.toBeInTheDocument();

      // Switch to empty configuration
      const select = screen.getByTestId("config-select");
      await user.selectOptions(select, "empty");

      // Now shows empty state
      expect(
        screen.getByText("No metrics or spans defined for this configuration.")
      ).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty telemetry array gracefully", () => {
      const telemetry: Telemetry[] = [];

      render(<TelemetrySection telemetry={telemetry} />);

      expect(
        screen.getByText("No metrics or spans defined for this configuration.")
      ).toBeInTheDocument();
    });
  });
});
