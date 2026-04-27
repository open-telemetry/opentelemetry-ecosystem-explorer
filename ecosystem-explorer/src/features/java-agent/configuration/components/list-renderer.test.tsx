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
import { render, screen, fireEvent } from "@testing-library/react";
import { ListRenderer } from "./list-renderer";
import type { ListNode } from "@/types/configuration";

const addListItem = vi.fn();
const removeListItem = vi.fn();

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: {
      values: { tp: { processors: [{}] } },
      enabledSections: {},
      validationErrors: {},
      version: "1.0.0",
      isDirty: false,
    },
    addListItem: (...a: unknown[]) => addListItem(...a),
    removeListItem: (...a: unknown[]) => removeListItem(...a),
    setValue: vi.fn(),
    setEnabled: vi.fn(),
    selectPlugin: vi.fn(),
  }),
}));

vi.mock("./schema-renderer", () => ({
  SchemaRenderer: ({ path, headless }: { path: string; headless?: boolean }) => (
    <span data-testid="child-path" data-headless={String(!!headless)}>
      {path}
    </span>
  ),
}));

const listNode: ListNode = {
  controlType: "list",
  key: "processors",
  label: "Processors",
  path: "tp.processors",
  itemSchema: {
    controlType: "group",
    key: "item",
    label: "Item",
    path: "tp.processors.item",
    children: [],
  },
};

function renderAndExpand() {
  const view = render(<ListRenderer node={listNode} depth={1} path="tp.processors" />);
  fireEvent.click(screen.getByRole("button", { name: /Expand Processors/ }));
  return view;
}

describe("ListRenderer", () => {
  it("renders a chevron header with the node label and starts collapsed", () => {
    render(<ListRenderer node={listNode} depth={1} path="tp.processors" />);
    const toggle = screen.getByRole("button", { name: /Expand Processors/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Items hidden until expanded.
    expect(screen.queryByText("Processor 1")).toBeNull();
  });

  it("renders an item card with the derived label and injects indexed path once expanded", () => {
    renderAndExpand();
    // Tier 3: parent label "Processors" -> "Processor 1"
    expect(screen.getByText("Processor 1")).toBeInTheDocument();
    const child = screen.getByTestId("child-path");
    expect(child.textContent).toBe("tp.processors[0]");
  });

  it("passes headless={true} to SchemaRenderer when itemSchema is a group", () => {
    renderAndExpand();
    expect(screen.getByTestId("child-path").getAttribute("data-headless")).toBe("true");
  });

  it("does not render a per-item 'fields set' summary chip", () => {
    renderAndExpand();
    expect(screen.queryByText(/field set/i)).toBeNull();
  });

  it("renders the + Add button in the list header", () => {
    render(<ListRenderer node={listNode} depth={1} path="tp.processors" />);
    const expand = screen.getByRole("button", { name: /Expand Processors/ });
    const add = screen.getByRole("button", { name: /Add item to Processors/ });
    expect(expand.parentElement).toBe(add.parentElement);
  });

  it("dispatches addListItem when Add clicked", () => {
    renderAndExpand();
    fireEvent.click(screen.getByRole("button", { name: /add item to processors/i }));
    expect(addListItem).toHaveBeenCalledWith("tp.processors");
  });

  it("dispatches removeListItem with the clicked index", () => {
    renderAndExpand();
    fireEvent.click(screen.getByRole("button", { name: /remove item 1/i }));
    expect(removeListItem).toHaveBeenCalledWith("tp.processors", 0);
  });

  it("renders the description in a tooltip, not as an inline paragraph", () => {
    const node: ListNode = {
      ...listNode,
      description: "Configure processors.",
    };
    render(<ListRenderer node={node} depth={1} path="tp.processors" />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Configure processors.");
    expect(screen.getAllByText("Configure processors.")).toHaveLength(1);
  });
});
