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
import { ModuleStatusFilter } from "./module-status-filter";

describe("ModuleStatusFilter", () => {
  it("renders a trigger labeled 'Status' showing the current value", () => {
    render(<ModuleStatusFilter value="" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Status" });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("All Statuses");
  });

  it("shows the selected status label on the trigger", () => {
    render(<ModuleStatusFilter value="changed" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Status" })).toHaveTextContent("Changed");
  });

  it("opens a floating menu with all four options in order", async () => {
    const user = userEvent.setup();
    render(<ModuleStatusFilter value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Status" }));

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "All Statuses",
      "Added",
      "Changed",
      "Removed",
    ]);
  });

  it("shows a checkmark beside the active option", async () => {
    const user = userEvent.setup();
    render(<ModuleStatusFilter value="removed" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Status" }));

    const removedItem = await screen.findByRole("menuitem", { name: "Removed" });
    expect(removedItem.querySelector("svg")).toBeInTheDocument();

    const addedItem = screen.getByRole("menuitem", { name: "Added" });
    expect(addedItem.querySelector("svg")).not.toBeInTheDocument();
  });

  it("calls onChange with the selected status and closes the menu", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModuleStatusFilter value="" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Status" }));
    const addedItem = await screen.findByRole("menuitem", { name: "Added" });
    await user.click(addedItem);

    expect(onChange).toHaveBeenCalledWith("added");
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("calls onChange with an empty string when 'All Statuses' is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModuleStatusFilter value="removed" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Status" }));
    const allItem = await screen.findByRole("menuitem", { name: "All Statuses" });
    await user.click(allItem);

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("supports keyboard navigation to open and select", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModuleStatusFilter value="" onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Status" })).toHaveFocus();

    await user.keyboard("{Enter}");
    await screen.findByRole("menuitem", { name: "All Statuses" });

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("added");
  });
});
