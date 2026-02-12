import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstrumentationFilterBar, type FilterState } from "./instrumentation-filter-bar";
import { FILTER_STYLES } from "../styles/filter-styles";

describe("InstrumentationFilterBar", () => {
  const defaultFilters: FilterState = {
    search: "",
    telemetry: new Set(),
    target: new Set(),
    semanticConventions: new Set(),
  };

  it("renders search input with correct placeholder", () => {
    const onFiltersChange = vi.fn();
    render(<InstrumentationFilterBar filters={defaultFilters} onFiltersChange={onFiltersChange} />);

    expect(screen.getByPlaceholderText("Search instrumentations...")).toBeInTheDocument();
  });

  it("calls onFiltersChange when search input changes", () => {
    const onFiltersChange = vi.fn();
    render(<InstrumentationFilterBar filters={defaultFilters} onFiltersChange={onFiltersChange} />);

    const input = screen.getByPlaceholderText("Search instrumentations...");
    fireEvent.change(input, { target: { value: "http" } });

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      search: "http",
    });
  });

  it("toggles spans telemetry filter on button click", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<InstrumentationFilterBar filters={defaultFilters} onFiltersChange={onFiltersChange} />);

    const spansButton = screen.getByRole("button", { name: "Spans" });
    await user.click(spansButton);

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      telemetry: new Set(["spans"]),
    });
  });

  it("toggles metrics telemetry filter on button click", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<InstrumentationFilterBar filters={defaultFilters} onFiltersChange={onFiltersChange} />);

    const metricsButton = screen.getByRole("button", { name: "Metrics" });
    await user.click(metricsButton);

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      telemetry: new Set(["metrics"]),
    });
  });

  it("removes telemetry filter when clicking active filter", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const activeFilters: FilterState = {
      ...defaultFilters,
      telemetry: new Set(["spans"]),
    };

    render(<InstrumentationFilterBar filters={activeFilters} onFiltersChange={onFiltersChange} />);

    const spansButton = screen.getByRole("button", { name: "Spans" });
    await user.click(spansButton);

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...activeFilters,
      telemetry: new Set(),
    });
  });

  it("toggles java agent target filter on button click", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<InstrumentationFilterBar filters={defaultFilters} onFiltersChange={onFiltersChange} />);

    const javaAgentButton = screen.getByRole("button", { name: "Java Agent" });
    await user.click(javaAgentButton);

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      target: new Set(["javaagent"]),
    });
  });

  it("toggles standalone target filter on button click", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<InstrumentationFilterBar filters={defaultFilters} onFiltersChange={onFiltersChange} />);

    const standaloneButton = screen.getByRole("button", { name: "Standalone" });
    await user.click(standaloneButton);

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      target: new Set(["library"]),
    });
  });

  it("applies active styles to selected filters", () => {
    const activeFilters: FilterState = {
      search: "",
      telemetry: new Set(["spans", "metrics"]),
      target: new Set(["javaagent"]),
      semanticConventions: new Set(),
    };

    render(<InstrumentationFilterBar filters={activeFilters} onFiltersChange={vi.fn()} />);

    const spansButton = screen.getByRole("button", { name: "Spans" });
    const metricsButton = screen.getByRole("button", { name: "Metrics" });
    const javaAgentButton = screen.getByRole("button", { name: "Java Agent" });
    const standaloneButton = screen.getByRole("button", { name: "Standalone" });

    expect(spansButton.className).toContain(FILTER_STYLES.telemetry.spans.active);
    expect(metricsButton.className).toContain(FILTER_STYLES.telemetry.metrics.active);
    expect(javaAgentButton.className).toContain(FILTER_STYLES.target.javaagent.active);
    expect(standaloneButton.className).toContain(FILTER_STYLES.target.library.inactive);
  });
});
