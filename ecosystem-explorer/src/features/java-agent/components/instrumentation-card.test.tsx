import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InstrumentationCard } from "./instrumentation-card";
import type { InstrumentationData } from "@/types/javaagent";
import type { FilterState } from "./instrumentation-filter-bar";
import { FILTER_STYLES } from "../styles/filter-styles";

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
    render(<InstrumentationCard instrumentation={baseInstrumentation} />);
    expect(screen.getByText("Test Instrumentation")).toBeInTheDocument();
  });

  it("falls back to name when display_name is not provided", () => {
    const instrumentation = { ...baseInstrumentation, display_name: undefined };
    render(<InstrumentationCard instrumentation={instrumentation} />);
    expect(screen.getByText("test-instrumentation")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<InstrumentationCard instrumentation={baseInstrumentation} />);
    expect(screen.getByText("A test instrumentation for testing purposes")).toBeInTheDocument();
  });

  it("displays Agent badge when javaagent target versions exist", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      target_versions: {
        javaagent: ["1.0.0", "2.0.0"],
      },
    };
    render(<InstrumentationCard instrumentation={instrumentation} />);
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("displays Library badge when library target versions exist", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      target_versions: {
        library: ["1.0.0"],
      },
    };
    render(<InstrumentationCard instrumentation={instrumentation} />);
    expect(screen.getByText("Library")).toBeInTheDocument();
  });

  it("displays both Agent and Library badges when both exist", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      target_versions: {
        javaagent: ["1.0.0"],
        library: ["1.0.0"],
      },
    };
    render(<InstrumentationCard instrumentation={instrumentation} />);
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
    render(<InstrumentationCard instrumentation={instrumentation} />);
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
    render(<InstrumentationCard instrumentation={instrumentation} />);
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
    render(<InstrumentationCard instrumentation={instrumentation} />);
    expect(screen.getByText("Spans")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
  });

  it("highlights Agent badge when javaagent filter is active", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      target_versions: { javaagent: ["1.0.0"] },
    };
    const activeFilters: FilterState = {
      search: "",
      telemetry: new Set(),
      target: new Set(["javaagent"]),
      semanticConventions: new Set(),
    };

    render(<InstrumentationCard instrumentation={instrumentation} activeFilters={activeFilters} />);

    const agentBadge = screen.getByText("Agent");
    expect(agentBadge.className).toContain(FILTER_STYLES.target.javaagent.active);
  });

  it("highlights Library badge when library filter is active", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      target_versions: { library: ["1.0.0"] },
    };
    const activeFilters: FilterState = {
      search: "",
      telemetry: new Set(),
      target: new Set(["library"]),
      semanticConventions: new Set(),
    };

    render(<InstrumentationCard instrumentation={instrumentation} activeFilters={activeFilters} />);

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
      semanticConventions: new Set(),
    };

    render(<InstrumentationCard instrumentation={instrumentation} activeFilters={activeFilters} />);

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
      semanticConventions: new Set(),
    };

    render(<InstrumentationCard instrumentation={instrumentation} activeFilters={activeFilters} />);

    const metricsBadge = screen.getByText("Metrics");
    expect(metricsBadge.className).toContain(FILTER_STYLES.telemetry.metrics.active);
  });

  it("displays semantic convention tags when provided", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      semantic_conventions: ["HTTP_CLIENT_SPANS", "DATABASE_CLIENT_SPANS"],
    };

    render(<InstrumentationCard instrumentation={instrumentation} />);

    expect(screen.getByText("HTTP")).toBeInTheDocument();
    expect(screen.getByText("Database")).toBeInTheDocument();
  });

  it("does not display semantic conventions section when none provided", () => {
    const instrumentation: InstrumentationData = {
      ...baseInstrumentation,
      semantic_conventions: undefined,
    };

    const { container } = render(<InstrumentationCard instrumentation={instrumentation} />);

    expect(container.querySelector(".border-t")).not.toBeInTheDocument();
  });
});
