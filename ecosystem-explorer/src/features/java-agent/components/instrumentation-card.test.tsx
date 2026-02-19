import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { InstrumentationCard } from "./instrumentation-card";
import type { InstrumentationData } from "@/types/javaagent";
import type { FilterState } from "./instrumentation-filter-bar";
import { FILTER_STYLES } from "../styles/filter-styles";

function renderCard(
  instrumentation: InstrumentationData,
  activeFilters?: FilterState,
  version = "2.0.0"
) {
  return render(
    <BrowserRouter>
      <InstrumentationCard
        instrumentation={instrumentation}
        activeFilters={activeFilters}
        version={version}
      />
    </BrowserRouter>
  );
}

describe("InstrumentationCard", () => {
  const baseInstrumentation: InstrumentationData = {
    name: "test-instrumentation",
    display_name: "Test Instrumentation",
    description: "A test instrumentation for testing purposes",
    scope: {
      name: "test",
    },
  };

  it("renders instrumentation display name", () => {
    renderCard(baseInstrumentation);
    expect(screen.getByText("Test Instrumentation")).toBeInTheDocument();
  });

  it("falls back to name when display_name is not provided", () => {
    const instrumentation = { ...baseInstrumentation, display_name: undefined };
    renderCard(instrumentation);
    expect(screen.getByText("test-instrumentation")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    renderCard(baseInstrumentation);
    expect(screen.getByText("A test instrumentation for testing purposes")).toBeInTheDocument();
  });

  it("displays Agent badge when javaagent target versions exist", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      javaagent_target_versions: ["1.0.0", "2.0.0"],
    };
    renderCard(instrumentation);
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("displays Library badge when library target versions exist", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      has_standalone_library: true,
    };
    renderCard(instrumentation);
    expect(screen.getByText("Library")).toBeInTheDocument();
  });

  it("displays both Agent and Library badges when both exist", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      javaagent_target_versions: ["1.0.0"],
      has_standalone_library: true,
    };
    renderCard(instrumentation);
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
  });

  it("displays Spans badge when telemetry includes spans", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      telemetry: [
        {
          when: "always",
          spans: [{ span_kind: "CLIENT" }],
        },
      ],
    };
    renderCard(instrumentation);
    expect(screen.getByText("Spans")).toBeInTheDocument();
  });

  it("displays Metrics badge when telemetry includes metrics", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      telemetry: [
        {
          when: "always",
          metrics: [
            {
              name: "test.metric",
              description: "Test metric",
              type: "COUNTER",
              unit: "1",
            },
          ],
        },
      ],
    };
    renderCard(instrumentation);
    expect(screen.getByText("Metrics")).toBeInTheDocument();
  });

  it("displays both Spans and Metrics badges when both exist", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      telemetry: [
        {
          when: "always",
          spans: [{ span_kind: "CLIENT" }],
          metrics: [
            {
              name: "test.metric",
              description: "Test metric",
              type: "COUNTER",
              unit: "1",
            },
          ],
        },
      ],
    };
    renderCard(instrumentation);
    expect(screen.getByText("Spans")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
  });

  it("highlights Agent badge when javaagent filter is active", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      javaagent_target_versions: ["1.0.0"],
    };
    const activeFilters: FilterState = {
      search: "",
      telemetry: new Set(),
      target: new Set(["javaagent"]),
    };

    renderCard(instrumentation, activeFilters);

    const agentBadge = screen.getByText("Agent");
    expect(agentBadge.className).toContain(FILTER_STYLES.target.javaagent.active);
  });

  it("highlights Library badge when library filter is active", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      has_standalone_library: true,
    };
    const activeFilters: FilterState = {
      search: "",
      telemetry: new Set(),
      target: new Set(["library"]),
    };

    renderCard(instrumentation, activeFilters);

    const libraryBadge = screen.getByText("Library");
    expect(libraryBadge.className).toContain(FILTER_STYLES.target.library.active);
  });

  it("highlights Spans badge when spans filter is active", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      telemetry: [{ when: "always", spans: [{ span_kind: "CLIENT" }] }],
    };
    const activeFilters: FilterState = {
      search: "",
      telemetry: new Set(["spans"]),
      target: new Set(),
    };

    renderCard(instrumentation, activeFilters);

    const spansBadge = screen.getByText("Spans");
    expect(spansBadge.className).toContain(FILTER_STYLES.telemetry.spans.active);
  });

  it("highlights Metrics badge when metrics filter is active", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      telemetry: [
        {
          when: "always",
          metrics: [
            {
              name: "test.metric",
              description: "Test",
              type: "COUNTER",
              unit: "1",
            },
          ],
        },
      ],
    };
    const activeFilters: FilterState = {
      search: "",
      telemetry: new Set(["metrics"]),
      target: new Set(),
    };

    renderCard(instrumentation, activeFilters);

    const metricsBadge = screen.getByText("Metrics");
    expect(metricsBadge.className).toContain(FILTER_STYLES.telemetry.metrics.active);
  });

  it("renders as a link to the instrumentation detail page", () => {
    renderCard(baseInstrumentation, undefined, "2.0.0");

    const link = screen.getByRole("link", {
      name: "View details for Test Instrumentation",
    });
    expect(link).toHaveAttribute("href", "/java-agent/instrumentation/2.0.0/test-instrumentation");
  });

  it("uses provided version in the detail page link", () => {
    renderCard(baseInstrumentation, undefined, "1.9.0");

    const link = screen.getByRole("link", {
      name: "View details for Test Instrumentation",
    });
    expect(link).toHaveAttribute("href", "/java-agent/instrumentation/1.9.0/test-instrumentation");
  });
});
