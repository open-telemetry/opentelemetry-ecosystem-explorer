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
import { CheckboxFacet, SearchFacet, SelectFacet } from "./facets";

const TYPE_OPTIONS = [
  { value: "receiver", label: "Receiver", count: 98, swatch: "hsl(200 85% 45%)" },
  { value: "processor", label: "Processor", count: 28, swatch: "hsl(265 70% 55%)" },
  { value: "exporter", label: "Exporter", count: 64 },
];

const VERSION_OPTIONS = [
  { value: "v0.150.0", label: "v0.150.0" },
  { value: "v0.149.0", label: "v0.149.0" },
];

const renderCheckbox = (props: Partial<Parameters<typeof CheckboxFacet>[0]> = {}) =>
  render(
    <CheckboxFacet
      title="Component type"
      options={TYPE_OPTIONS}
      selected={[]}
      onChange={vi.fn()}
      {...props}
    />
  );

const renderSearch = (props: Partial<Parameters<typeof SearchFacet>[0]> = {}) =>
  render(<SearchFacet title="Search" value="" onChange={vi.fn()} {...props} />);

const renderSelect = (props: Partial<Parameters<typeof SelectFacet>[0]> = {}) =>
  render(
    <SelectFacet
      title="Version"
      options={VERSION_OPTIONS}
      value={null}
      onChange={vi.fn()}
      emptyLabel="Latest"
      {...props}
    />
  );

describe("CheckboxFacet", () => {
  it("labels the group by its title and renders each option with its count", () => {
    renderCheckbox();

    expect(screen.getByRole("group", { name: "Component type" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /receiver/i })).toBeInTheDocument();
    expect(screen.getByText("98")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
  });

  it("reflects the selected state on the matching checkboxes", () => {
    renderCheckbox({ selected: ["receiver"] });

    expect(screen.getByRole("checkbox", { name: /receiver/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /processor/i })).not.toBeChecked();
  });

  it("adds a value to the selection when an unchecked option is toggled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderCheckbox({ selected: ["receiver"], onChange });

    await user.click(screen.getByRole("checkbox", { name: /processor/i }));
    expect(onChange).toHaveBeenCalledWith(["processor", "receiver"]);
  });

  it("removes a value from the selection when a checked option is toggled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderCheckbox({ selected: ["receiver"], onChange });

    await user.click(screen.getByRole("checkbox", { name: /receiver/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("SearchFacet", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("associates the input with the title and renders the placeholder", () => {
    renderSearch({ title: "Filter", placeholder: "Type to filter" });

    expect(screen.getByRole("searchbox", { name: "Filter" })).toHaveAttribute(
      "placeholder",
      "Type to filter"
    );
    expect(screen.getByRole("search", { name: "Filter" })).toBeInTheDocument();
  });

  it("debounces onChange until the delay elapses", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderSearch({ onChange, debounceMs: 250 });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "otlp" },
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("otlp");
  });

  it("syncs the input when the upstream value is cleared externally", () => {
    const { rerender } = render(<SearchFacet title="Search" value="redis" onChange={vi.fn()} />);
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("redis");

    rerender(<SearchFacet title="Search" value="" onChange={vi.fn()} />);
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("");
  });

  it("does not emit pending edits after an external clear", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchFacet title="Search" value="redis" onChange={onChange} debounceMs={250} />
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "redisx" },
    });
    rerender(<SearchFacet title="Search" value="" onChange={onChange} debounceMs={250} />);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("SelectFacet", () => {
  it("renders the empty label and every option", () => {
    renderSelect();

    const select = screen.getByRole("combobox", { name: "Version" });
    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "Latest" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "v0.150.0" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "v0.149.0" })).toBeInTheDocument();
  });

  it("fires onChange with the selected value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ onChange });

    await user.selectOptions(screen.getByRole("combobox", { name: "Version" }), "v0.149.0");
    expect(onChange).toHaveBeenCalledWith("v0.149.0");
  });

  it("fires onChange with null when the empty option is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ onChange, value: "v0.150.0" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Version" }), "Latest");
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
