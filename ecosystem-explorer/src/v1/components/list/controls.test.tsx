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
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS, type ListFilters } from "@/v1/lib/list-filters";
import {
  ActiveFilterChips,
  DensityToggle,
  EmptyState,
  FacetDrawerToggle,
  Pagination,
  SortDropdown,
} from "./controls";

const sampleFilters: ListFilters = {
  ...DEFAULT_FILTERS,
  types: ["receiver", "processor"],
  signals: ["traces"],
  q: "kafka",
};

const renderChips = (props: Partial<Parameters<typeof ActiveFilterChips>[0]> = {}) =>
  render(<ActiveFilterChips filters={sampleFilters} onChange={() => {}} {...props} />);

const renderDensityToggle = (props: Partial<Parameters<typeof DensityToggle>[0]> = {}) =>
  render(<DensityToggle value="compact" onChange={() => {}} {...props} />);

const renderSortDropdown = (props: Partial<Parameters<typeof SortDropdown>[0]> = {}) =>
  render(<SortDropdown value="name" onChange={() => {}} {...props} />);

const renderPagination = (props: Partial<Parameters<typeof Pagination>[0]> = {}) =>
  render(<Pagination page={1} totalPages={4} onChange={() => {}} {...props} />);

const renderEmptyState = (props: Partial<Parameters<typeof EmptyState>[0]> = {}) =>
  render(<EmptyState hasActiveFilters onClearAll={() => {}} {...props} />);

const renderFacetToggle = (props: Partial<Parameters<typeof FacetDrawerToggle>[0]> = {}) =>
  render(<FacetDrawerToggle filters={sampleFilters} onClick={() => {}} {...props} />);

describe("ActiveFilterChips", () => {
  it("renders nothing when no filters are active", () => {
    const { container } = renderChips({ filters: DEFAULT_FILTERS });
    expect(container.firstChild).toBeNull();
  });

  it("renders one chip per active filter plus a Clear-all", () => {
    renderChips();
    expect(screen.getByRole("button", { name: "Remove filter Search: kafka" })).toBeInTheDocument();
    expect(screen.getByText("Type: Receiver")).toBeInTheDocument();
    expect(screen.getByText("Type: Processor")).toBeInTheDocument();
    expect(screen.getByText("Signal: Traces")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clear all/i })).toBeInTheDocument();
  });

  it("localizes facet chip labels through the collector namespace instead of raw filter values", () => {
    renderChips();
    expect(screen.queryByText("Type: receiver")).toBeNull();
    expect(screen.queryByText("Signal: traces")).toBeNull();
  });

  it("dispatches a filter change when a chip is clicked", () => {
    const onChange = vi.fn();
    renderChips({ onChange });
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Type: Receiver" }));
    expect(onChange).toHaveBeenCalledWith({ types: ["processor"] });
  });

  it("Clear-all resets every multi-select + search + version + page", () => {
    const onChange = vi.fn();
    renderChips({ onChange });
    fireEvent.click(screen.getByRole("button", { name: /Clear all/i }));
    expect(onChange).toHaveBeenCalledWith({
      q: "",
      types: [],
      signals: [],
      stabilities: [],
      distributions: [],
      version: null,
      page: 1,
    });
  });
});

describe("DensityToggle", () => {
  it("renders three buttons and marks the active one as pressed", () => {
    const onChange = vi.fn();
    renderDensityToggle({ onChange });
    const compact = screen.getByRole("button", { name: /Compact/i });
    expect(compact).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Cards/i })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: /Table/i }));
    expect(onChange).toHaveBeenCalledWith("table");
  });
});

describe("SortDropdown", () => {
  it("renders one option per sort mode", () => {
    renderSortDropdown();
    expect(screen.getByRole("option", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Recently updated" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Stability" })).toBeInTheDocument();
  });

  it("dispatches the new sort mode on change", () => {
    const onChange = vi.fn();
    renderSortDropdown({ onChange });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "updated" } });
    expect(onChange).toHaveBeenCalledWith("updated");
  });
});

describe("Pagination", () => {
  it("does not render when totalPages <= 1", () => {
    const { container } = renderPagination({ totalPages: 1 });
    expect(container.firstChild).toBeNull();
  });

  it("disables Previous on the first page and Next on the last", () => {
    const { rerender } = renderPagination();
    expect(screen.getByRole("button", { name: /Previous page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Next page/i })).not.toBeDisabled();

    rerender(<Pagination page={4} totalPages={4} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Previous page/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Next page/i })).toBeDisabled();
  });

  it("announces the current page and dispatches page changes", () => {
    const onChange = vi.fn();
    renderPagination({ page: 2, onChange });
    expect(screen.getByText("Page 2 of 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Previous page/i }));
    expect(onChange).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: /Next page/i }));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe("EmptyState", () => {
  it("offers a Clear-all action only when filters are active", () => {
    const onClearAll = vi.fn();
    renderEmptyState({ onClearAll });
    const clearAll = screen.getByRole("button", { name: /Clear all filters/i });
    expect(clearAll).toBeInTheDocument();
    fireEvent.click(clearAll);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("omits the Clear-all action when there are no filters", () => {
    renderEmptyState({ hasActiveFilters: false });
    expect(screen.queryByRole("button", { name: /Clear all filters/i })).toBeNull();
  });
});

describe("FacetDrawerToggle", () => {
  it("shows the active-filter count in the badge and accessible name", () => {
    renderFacetToggle();
    const toggle = screen.getByRole("button", { name: "Open filters (4 active)" });
    expect(toggle).toHaveTextContent("4");
  });

  it("omits the badge and count when filters are at their defaults", () => {
    renderFacetToggle({ filters: DEFAULT_FILTERS });
    const toggle = screen.getByRole("button", { name: "Open filters" });
    expect(toggle).not.toHaveTextContent("0");
  });

  it("invokes onClick when activated", () => {
    const onClick = vi.fn();
    renderFacetToggle({ onClick });
    fireEvent.click(screen.getByRole("button", { name: /Open filters/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
