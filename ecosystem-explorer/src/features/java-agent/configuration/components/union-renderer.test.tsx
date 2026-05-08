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
import { UnionRenderer } from "./union-renderer";
import type { UnionNode } from "@/types/configuration";

const setValue = vi.fn();

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: {
      values: { value: "x" },
      enabledSections: {},
      validationErrors: {},
      version: "1.0.0",
      isDirty: false,
    },
    setValue: (...a: unknown[]) => setValue(...a),
    setEnabled: vi.fn(),
    selectPlugin: vi.fn(),
  }),
}));

vi.mock("./schema-renderer", () => ({
  SchemaRenderer: ({
    node,
    inline,
  }: {
    node: { key: string; label: string; hideLabel?: boolean };
    inline?: boolean;
  }) => (
    <span
      data-testid="variant"
      data-hide-label={String(!!node.hideLabel)}
      data-inline={String(!!inline)}
      data-label={node.label}
    >
      {node.key}
    </span>
  ),
}));

const unionNode: UnionNode = {
  controlType: "union",
  key: "value",
  label: "Value",
  path: "value",
  variants: [
    { controlType: "text_input", key: "string", label: "String", path: "value" },
    { controlType: "number_input", key: "int", label: "Int", path: "value" },
  ],
};

describe("UnionRenderer", () => {
  it("renders a tab per variant", () => {
    render(<UnionRenderer node={unionNode} depth={1} path="value" />);
    expect(screen.getByRole("tab", { name: "String" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Int" })).toBeInTheDocument();
  });

  it("infers the selected variant from the stored value type (string)", () => {
    render(<UnionRenderer node={unionNode} depth={1} path="value" />);
    expect(screen.getByTestId("variant")).toHaveTextContent("string");
    expect(screen.getByRole("tab", { name: "String" })).toHaveAttribute("aria-selected", "true");
  });

  it("dispatches setValue with the variant's empty value on tab click", () => {
    render(<UnionRenderer node={unionNode} depth={1} path="value" />);
    fireEvent.click(screen.getByRole("tab", { name: "Int" }));
    expect(setValue).toHaveBeenCalledWith("value", 0);
  });

  it("uses the label verbatim when it is not a generic 'Variant N'", () => {
    const n: UnionNode = {
      controlType: "union",
      key: "v",
      label: "V",
      path: "v",
      variants: [{ controlType: "text_input", key: "a", label: "String", path: "v" }],
    };
    render(<UnionRenderer node={n} depth={1} path="v" />);
    expect(screen.getByRole("tab", { name: "String" })).toBeInTheDocument();
  });

  it("derives the inner item type for anonymous list variants ('list of toggle' -> 'Boolean list')", () => {
    const n: UnionNode = {
      controlType: "union",
      key: "v",
      label: "V",
      path: "v",
      variants: [
        { controlType: "text_input", key: "a", label: "Variant 0", path: "v" },
        {
          controlType: "list",
          key: "b",
          label: "Variant 1",
          path: "v",
          itemSchema: { controlType: "toggle", key: "item", label: "Item", path: "v.item" },
        },
        {
          controlType: "list",
          key: "c",
          label: "Variant 2",
          path: "v",
          itemSchema: {
            controlType: "group",
            key: "item",
            label: "Item",
            path: "v.item",
            children: [],
          },
        },
      ],
    };
    render(<UnionRenderer node={n} depth={1} path="v" />);
    expect(screen.getByRole("tab", { name: "Boolean list" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Group list" })).toBeInTheDocument();
  });

  it("falls back to a pretty controlType label when the schema label is 'Variant N'", () => {
    const n: UnionNode = {
      controlType: "union",
      key: "v",
      label: "V",
      path: "v",
      variants: [
        { controlType: "text_input", key: "a", label: "Variant 0", path: "v" },
        { controlType: "toggle", key: "b", label: "Variant 1", path: "v" },
        { controlType: "number_list", key: "c", label: "Variant 2", path: "v" },
      ],
    };
    render(<UnionRenderer node={n} depth={1} path="v" />);
    expect(screen.getByRole("tab", { name: "Text" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Boolean" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Number list" })).toBeInTheDocument();
  });

  it("filters out empty-group variants", () => {
    const n: UnionNode = {
      controlType: "union",
      key: "v",
      label: "V",
      path: "v",
      variants: [
        { controlType: "text_input", key: "a", label: "Variant 0", path: "v" },
        { controlType: "group", key: "b", label: "Variant 1", children: [], path: "v" },
        { controlType: "toggle", key: "c", label: "Variant 2", path: "v" },
      ],
    };
    render(<UnionRenderer node={n} depth={1} path="v" />);
    expect(screen.getByRole("tab", { name: "Text" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Group" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Boolean" })).toBeInTheDocument();
  });

  it("renders the first variant without a tablist when every variant is filtered out", () => {
    const n: UnionNode = {
      controlType: "union",
      key: "v",
      label: "V",
      path: "v",
      variants: [{ controlType: "group", key: "b", label: "Variant 0", children: [], path: "v" }],
    };
    render(<UnionRenderer node={n} depth={1} path="v" />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByTestId("variant")).toHaveTextContent("b");
  });

  it("preserves the user's explicit List pick when inference is ambiguous between multiple array variants", () => {
    const n: UnionNode = {
      controlType: "union",
      key: "v",
      label: "V",
      path: "v",
      variants: [
        { controlType: "string_list", key: "a", label: "Variant 0", path: "v" },
        {
          controlType: "list",
          key: "b",
          label: "Variant 1",
          path: "v",
          itemSchema: { controlType: "toggle", key: "item", label: "Item", path: "v.item" },
        },
        { controlType: "number_list", key: "c", label: "Variant 2", path: "v" },
      ],
    };

    render(<UnionRenderer node={n} depth={1} path="v" />);
    fireEvent.click(screen.getByRole("tab", { name: "Boolean list" }));
    expect(screen.getByRole("tab", { name: "Boolean list" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("renders the union's own label visibly via the FieldSection chevron row", () => {
    render(<UnionRenderer node={unionNode} depth={1} path="value" />);
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Collapse Value/ })).toBeInTheDocument();
  });

  it("renders the selected variant inline with hideLabel=true and the display name in place of 'Variant N'", () => {
    const n: UnionNode = {
      controlType: "union",
      key: "v",
      label: "V",
      path: "v",
      variants: [{ controlType: "text_input", key: "a", label: "Variant 0", path: "v" }],
    };
    render(<UnionRenderer node={n} depth={1} path="v" />);
    const variantSpan = screen.getByTestId("variant");
    expect(variantSpan.getAttribute("data-hide-label")).toBe("true");
    expect(variantSpan.getAttribute("data-inline")).toBe("true");
    expect(variantSpan.getAttribute("data-label")).toBe("Text");
  });

  it("renders the description in a tooltip via the chevron-row Info, not as an inline paragraph", () => {
    const n: UnionNode = {
      controlType: "union",
      key: "sampler",
      label: "Sampler",
      path: "tracer_provider.sampler",
      description: "Choose a sampling strategy.",
      variants: [
        { controlType: "text_input", key: "a", label: "Var 0", path: "tracer_provider.sampler" },
        { controlType: "toggle", key: "b", label: "Var 1", path: "tracer_provider.sampler" },
      ],
    };
    render(<UnionRenderer node={n} depth={1} path="tracer_provider.sampler" />);
    expect(screen.getAllByText("Choose a sampling strategy.")).toHaveLength(1);
  });

  it("lets unambiguous inference override a stale manualPick when the value type changes", () => {
    const n: UnionNode = {
      controlType: "union",
      key: "v",
      label: "V",
      path: "v",
      variants: [
        { controlType: "text_input", key: "a", label: "String", path: "v" },
        { controlType: "number_input", key: "b", label: "Number", path: "v" },
      ],
    };
    render(<UnionRenderer node={n} depth={1} path="v" />);
    expect(screen.getByRole("tab", { name: "String" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Number" }));
    expect(setValue).toHaveBeenLastCalledWith("v", 0);
  });
});
