import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TargetBadges, TelemetryBadges } from "./instrumentation-badges";
import type { BadgeInfo } from "../utils/badge-info";
import type { FilterState } from "./instrumentation-filter-bar";
import { FILTER_STYLES } from "../styles/filter-styles";

const allFalse: BadgeInfo = {
  hasSpans: false,
  hasMetrics: false,
  hasJavaAgentTarget: false,
  hasLibraryTarget: false,
};

const allTrue: BadgeInfo = {
  hasSpans: true,
  hasMetrics: true,
  hasJavaAgentTarget: true,
  hasLibraryTarget: true,
};

const defaultFilters: FilterState = {
  search: "",
  telemetry: new Set(),
  target: new Set(),
};

describe("TargetBadges", () => {
  it("renders nothing when no target badges are present", () => {
    const { container } = render(<TargetBadges badges={allFalse} activeFilters={defaultFilters} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders Agent badge when hasJavaAgentTarget is true", () => {
    render(
      <TargetBadges
        badges={{ ...allFalse, hasJavaAgentTarget: true }}
        activeFilters={defaultFilters}
      />
    );
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByTitle("Java Agent")).toBeInTheDocument();
    expect(screen.getByLabelText("Has Java Agent target")).toBeInTheDocument();
  });

  it("renders Library badge when hasLibraryTarget is true", () => {
    render(
      <TargetBadges
        badges={{ ...allFalse, hasLibraryTarget: true }}
        activeFilters={defaultFilters}
      />
    );
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByTitle("Standalone Library")).toBeInTheDocument();
    expect(screen.getByLabelText("Has standalone library target")).toBeInTheDocument();
  });

  it("highlights Agent badge when javaagent filter is active", () => {
    const filters: FilterState = {
      search: "",
      telemetry: new Set(),
      target: new Set(["javaagent"]),
    };
    render(
      <TargetBadges badges={{ ...allFalse, hasJavaAgentTarget: true }} activeFilters={filters} />
    );
    expect(screen.getByText("Agent").className).toContain(FILTER_STYLES.target.javaagent.active);
  });

  it("highlights Library badge when library filter is active", () => {
    const filters: FilterState = { search: "", telemetry: new Set(), target: new Set(["library"]) };
    render(
      <TargetBadges badges={{ ...allFalse, hasLibraryTarget: true }} activeFilters={filters} />
    );
    expect(screen.getByText("Library").className).toContain(FILTER_STYLES.target.library.active);
  });

  it("uses compact size classes when size is compact", () => {
    render(<TargetBadges badges={allTrue} activeFilters={defaultFilters} size="compact" />);
    const agent = screen.getByText("Agent");
    expect(agent.className).toContain("px-1.5");
    expect(agent.className).not.toContain("px-2");
  });
});

describe("TelemetryBadges", () => {
  it("renders nothing when no telemetry badges are present", () => {
    const { container } = render(
      <TelemetryBadges badges={allFalse} activeFilters={defaultFilters} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders Spans badge when hasSpans is true", () => {
    render(
      <TelemetryBadges badges={{ ...allFalse, hasSpans: true }} activeFilters={defaultFilters} />
    );
    expect(screen.getByText("Spans")).toBeInTheDocument();
    expect(screen.getByTitle("Span telemetry")).toBeInTheDocument();
    expect(screen.getByLabelText("Has span telemetry")).toBeInTheDocument();
  });

  it("renders Metrics badge when hasMetrics is true", () => {
    render(
      <TelemetryBadges badges={{ ...allFalse, hasMetrics: true }} activeFilters={defaultFilters} />
    );
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByTitle("Metric telemetry")).toBeInTheDocument();
    expect(screen.getByLabelText("Has metric telemetry")).toBeInTheDocument();
  });

  it("highlights Spans badge when spans filter is active", () => {
    const filters: FilterState = { search: "", telemetry: new Set(["spans"]), target: new Set() };
    render(<TelemetryBadges badges={{ ...allFalse, hasSpans: true }} activeFilters={filters} />);
    expect(screen.getByText("Spans").className).toContain(FILTER_STYLES.telemetry.spans.active);
  });

  it("highlights Metrics badge when metrics filter is active", () => {
    const filters: FilterState = { search: "", telemetry: new Set(["metrics"]), target: new Set() };
    render(<TelemetryBadges badges={{ ...allFalse, hasMetrics: true }} activeFilters={filters} />);
    expect(screen.getByText("Metrics").className).toContain(FILTER_STYLES.telemetry.metrics.active);
  });
});
