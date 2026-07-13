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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollectorTelemetryTab } from "./collector-telemetry-tab";
import type { CollectorMetric, CollectorAttribute } from "@/types/collector";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sumMetric: CollectorMetric = {
  description: "The number of binds per second performed by the domain controller.",
  enabled: true,
  unit: "{binds}/s",
  stability: "development",
  sum: { monotonic: false, aggregation_temporality: "cumulative", value_type: "double" },
  attributes: ["bind_type"],
};

const gaugeMetric: CollectorMetric = {
  description: "The number of threads in use by the directory service.",
  enabled: false,
  unit: "{threads}",
  stability: "stable",
  gauge: { value_type: "int" },
};

const histogramMetric: CollectorMetric = {
  description: "Distribution of request durations.",
  enabled: true,
  unit: "ms",
  stability: "beta",
  histogram: { value_type: "double", bucket_boundaries: [0, 5, 10, 25, 50] },
};

const sampleMetrics: Record<string, CollectorMetric> = {
  "active_directory.ds.bind.rate": sumMetric,
  "active_directory.ds.thread.count": gaugeMetric,
};

const sampleAttributes: Record<string, CollectorAttribute> = {
  bind_type: {
    description: "The type of bind to the domain server.",
    type: "string",
    enum: ["client", "server"],
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CollectorTelemetryTab", () => {
  it("renders all metric names", () => {
    render(<CollectorTelemetryTab metrics={sampleMetrics} />);
    expect(screen.getByText("active_directory.ds.bind.rate")).toBeInTheDocument();
    expect(screen.getByText("active_directory.ds.thread.count")).toBeInTheDocument();
  });

  it("renders the correct type badge for a sum metric", () => {
    render(<CollectorTelemetryTab metrics={{ "my.metric": sumMetric }} />);
    expect(screen.getByText("Sum")).toBeInTheDocument();
  });

  it("renders the correct type badge for a gauge metric", () => {
    render(<CollectorTelemetryTab metrics={{ "my.metric": gaugeMetric }} />);
    expect(screen.getByText("Gauge")).toBeInTheDocument();
  });

  it("renders the correct type badge for a histogram metric", () => {
    render(<CollectorTelemetryTab metrics={{ "my.metric": histogramMetric }} />);
    expect(screen.getByText("Histogram")).toBeInTheDocument();
  });

  it("renders 'Enabled' badge for enabled metrics", () => {
    render(<CollectorTelemetryTab metrics={{ "my.metric": sumMetric }} />);
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("renders 'Disabled (opt-in)' badge for disabled metrics", () => {
    render(<CollectorTelemetryTab metrics={{ "my.metric": gaugeMetric }} />);
    expect(screen.getByText("Disabled (opt-in)")).toBeInTheDocument();
  });

  it("renders stability badge when stability is set", () => {
    render(<CollectorTelemetryTab metrics={{ "my.metric": sumMetric }} />);
    expect(screen.getByText("development")).toBeInTheDocument();
  });

  it("shows empty state when metrics is empty", () => {
    render(<CollectorTelemetryTab metrics={{}} />);
    expect(
      screen.getByText("No telemetry metrics are defined for this component.")
    ).toBeInTheDocument();
  });

  it("starts with all cards expanded by default", () => {
    render(<CollectorTelemetryTab metrics={sampleMetrics} />);
    // Description is visible only when expanded
    expect(
      screen.getByText("The number of binds per second performed by the domain controller.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("The number of threads in use by the directory service.")
    ).toBeInTheDocument();
  });

  it("collapses a card when its header button is clicked", async () => {
    const user = userEvent.setup();
    render(<CollectorTelemetryTab metrics={{ "my.metric": sumMetric }} />);

    // Description is visible (card starts expanded)
    expect(
      screen.getByText("The number of binds per second performed by the domain controller.")
    ).toBeInTheDocument();

    // Click the metric header to collapse
    await user.click(screen.getByRole("button", { name: /my\.metric/i }));

    // Description should now be hidden
    expect(
      screen.queryByText("The number of binds per second performed by the domain controller.")
    ).not.toBeInTheDocument();
  });

  it("expands a collapsed card when its header button is clicked again", async () => {
    const user = userEvent.setup();
    render(<CollectorTelemetryTab metrics={{ "my.metric": sumMetric }} />);

    const metricButton = screen.getByRole("button", { name: /my\.metric/i });

    // Collapse
    await user.click(metricButton);
    expect(
      screen.queryByText("The number of binds per second performed by the domain controller.")
    ).not.toBeInTheDocument();

    // Expand again
    await user.click(metricButton);
    expect(
      screen.getByText("The number of binds per second performed by the domain controller.")
    ).toBeInTheDocument();
  });

  it("Collapse All button hides all expanded card bodies", async () => {
    const user = userEvent.setup();
    render(<CollectorTelemetryTab metrics={sampleMetrics} />);

    await user.click(screen.getByRole("button", { name: /collapse all/i }));

    expect(
      screen.queryByText("The number of binds per second performed by the domain controller.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("The number of threads in use by the directory service.")
    ).not.toBeInTheDocument();
  });

  it("Expand All button restores all card bodies after collapse", async () => {
    const user = userEvent.setup();
    render(<CollectorTelemetryTab metrics={sampleMetrics} />);

    await user.click(screen.getByRole("button", { name: /collapse all/i }));
    await user.click(screen.getByRole("button", { name: /expand all/i }));

    expect(
      screen.getByText("The number of binds per second performed by the domain controller.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("The number of threads in use by the directory service.")
    ).toBeInTheDocument();
  });

  it("shows the unit in expanded view", () => {
    render(<CollectorTelemetryTab metrics={{ "my.metric": sumMetric }} />);
    expect(screen.getByText("{binds}/s")).toBeInTheDocument();
  });

  it("shows aggregation info for sum metrics", () => {
    render(<CollectorTelemetryTab metrics={{ "my.metric": sumMetric }} />);
    expect(screen.getByText("cumulative")).toBeInTheDocument();
    expect(screen.getByText(/monotonic/i)).toBeInTheDocument();
  });

  it("shows bucket boundaries for histogram metrics", () => {
    render(<CollectorTelemetryTab metrics={{ "my.metric": histogramMetric }} />);
    expect(screen.getByText(/0, 5, 10, 25, 50/)).toBeInTheDocument();
  });

  it("resolves attribute keys to descriptions when attributes prop is provided", () => {
    render(
      <CollectorTelemetryTab
        metrics={{ "active_directory.ds.bind.rate": sumMetric }}
        attributes={sampleAttributes}
      />
    );
    // The attribute key should appear in the table
    expect(screen.getByText("The type of bind to the domain server.")).toBeInTheDocument();
    expect(screen.getByText("string")).toBeInTheDocument();
  });

  it("shows raw key when attribute definition is not found", () => {
    render(
      <CollectorTelemetryTab
        metrics={{ "my.metric": sumMetric }}
        // No attributes prop — keys should still render
      />
    );
    expect(screen.getByText("bind_type")).toBeInTheDocument();
  });

  it("applies aria-expanded=true to expanded card buttons", () => {
    render(<CollectorTelemetryTab metrics={{ "my.metric": sumMetric }} />);
    const btn = screen.getByRole("button", { name: /my\.metric/i });
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("applies aria-expanded=false to collapsed card buttons", async () => {
    const user = userEvent.setup();
    render(<CollectorTelemetryTab metrics={{ "my.metric": sumMetric }} />);
    const btn = screen.getByRole("button", { name: /my\.metric/i });
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("resolves attribute keys to descriptions from resourceAttributes", () => {
    render(
      <CollectorTelemetryTab
        metrics={{ "active_directory.ds.bind.rate": sumMetric }}
        resourceAttributes={sampleAttributes}
      />
    );
    // The attribute key should appear in the table
    expect(screen.getByText("The type of bind to the domain server.")).toBeInTheDocument();
    expect(screen.getByText("string")).toBeInTheDocument();
  });

  it("sorts metrics alphabetically", () => {
    render(<CollectorTelemetryTab metrics={{ "z.metric": sumMetric, "a.metric": sumMetric }} />);
    const buttons = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent?.includes(".metric"));
    expect(buttons[0]).toHaveTextContent("a.metric");
    expect(buttons[1]).toHaveTextContent("z.metric");
  });
});
