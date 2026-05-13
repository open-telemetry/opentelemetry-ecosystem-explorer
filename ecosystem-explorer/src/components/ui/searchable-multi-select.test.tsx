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
import { SearchableMultiSelect, SelectedChips } from "./searchable-multi-select";

describe("SearchableMultiSelect", () => {
  const options = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
  const defaultProps = {
    label: "Fruits",
    placeholder: "Select fruits...",
    options,
    selected: [],
    onChange: vi.fn(),
  };

  it("renders correctly with placeholder", () => {
    render(<SearchableMultiSelect {...defaultProps} />);
    expect(screen.getByText("Fruits")).toBeInTheDocument();
    expect(screen.getByText("Select fruits...")).toBeInTheDocument();
  });

  it("shows number of selected items when selection exists", () => {
    render(<SearchableMultiSelect {...defaultProps} selected={["Apple", "Banana"]} />);
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("opens popover on click and displays options", async () => {
    const user = userEvent.setup();
    render(<SearchableMultiSelect {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: "Fruits" });
    await user.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    for (const option of options) {
      expect(screen.getByRole("option", { name: option })).toBeInTheDocument();
    }
  });

  it("filters options when typing in search input", async () => {
    const user = userEvent.setup();
    render(<SearchableMultiSelect {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Fruits" }));

    const searchInput = screen.getByPlaceholderText("Search...");
    await user.type(searchInput, "ba");

    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeInTheDocument();
  });

  it("calls onChange when an option is toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchableMultiSelect {...defaultProps} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Fruits" }));
    await user.click(screen.getByRole("option", { name: "Banana" }));

    expect(onChange).toHaveBeenCalledWith(["Banana"]);
  });

  it("removes option if already selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableMultiSelect {...defaultProps} selected={["Apple", "Banana"]} onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "Fruits" }));
    await user.click(screen.getByRole("option", { name: "Banana" }));

    expect(onChange).toHaveBeenCalledWith(["Apple"]);
  });
});

describe("SelectedChips", () => {
  it("renders nothing if selected is empty", () => {
    const { container } = render(<SelectedChips selected={[]} onRemove={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders chips for selected items", () => {
    render(<SelectedChips selected={["Apple", "Banana"]} onRemove={vi.fn()} />);
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("calls onRemove when a chip's remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<SelectedChips selected={["Apple", "Banana"]} onRemove={onRemove} />);

    const removeAppleButton = screen.getByRole("button", { name: "Remove Apple" });
    await user.click(removeAppleButton);

    expect(onRemove).toHaveBeenCalledWith("Apple");
  });
});
