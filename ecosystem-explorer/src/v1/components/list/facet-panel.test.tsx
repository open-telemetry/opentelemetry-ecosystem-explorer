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
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS, type ListFilters } from "@/v1/lib/list-filters";
import { FacetPanel } from "./facet-panel";

const renderPanel = (props: Partial<Parameters<typeof FacetPanel>[0]> = {}) =>
  render(<FacetPanel filters={DEFAULT_FILTERS} onChange={vi.fn()} {...props} />);

describe("FacetPanel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the filters rail with the search facet and one group per checkbox facet", () => {
    renderPanel();

    expect(screen.getByRole("complementary", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Search" })).toBeInTheDocument();
    for (const title of ["Type", "Signal", "Stability", "Distribution"]) {
      expect(screen.getByRole("group", { name: title })).toBeInTheDocument();
    }
    expect(screen.queryByRole("combobox", { name: "Version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close filters" })).not.toBeInTheDocument();
  });

  it("renders the version select when versions are provided", () => {
    renderPanel({ versions: ["v0.150.0", "v0.149.0"] });

    expect(screen.getByRole("combobox", { name: "Version" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Latest" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "v0.150.0" })).toBeInTheDocument();
  });

  it("reflects the incoming filters on the facet controls", () => {
    const filters: ListFilters = {
      ...DEFAULT_FILTERS,
      signals: ["traces"],
      version: "v0.149.0",
    };
    renderPanel({ filters, versions: ["v0.150.0", "v0.149.0"] });

    expect(screen.getByRole("checkbox", { name: /traces/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /metrics/i })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Version" })).toHaveValue("v0.149.0");
  });

  it("surfaces facet counts next to the matching options", () => {
    renderPanel({ counts: { types: { receiver: 98 }, distributions: { core: 41 } } });

    expect(screen.getByText("98")).toBeInTheDocument();
    expect(screen.getByText("41")).toBeInTheDocument();
  });

  it("emits the toggled facet and resets to page 1", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPanel({ filters: { ...DEFAULT_FILTERS, page: 3 }, onChange });

    await user.click(screen.getByRole("checkbox", { name: /receiver/i }));
    expect(onChange).toHaveBeenCalledWith({ types: ["receiver"], page: 1 });
  });

  it("emits the version and resets to page 1 when the select changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onChange, versions: ["v0.150.0", "v0.149.0"] });

    await user.selectOptions(screen.getByRole("combobox", { name: "Version" }), "v0.149.0");
    expect(onChange).toHaveBeenCalledWith({ version: "v0.149.0", page: 1 });
  });

  it("emits the debounced query and resets to page 1", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderPanel({ onChange });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "otlp" },
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ q: "otlp", page: 1 });
  });

  it("fires onClose from the drawer close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel({ isOpen: true, onClose });

    await user.click(screen.getByRole("button", { name: "Close filters" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes the open drawer on Escape", () => {
    const onClose = vi.fn();
    renderPanel({ isOpen: true, onClose });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignores Escape while the drawer is closed", () => {
    const onClose = vi.fn();
    renderPanel({ isOpen: false, onClose });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
