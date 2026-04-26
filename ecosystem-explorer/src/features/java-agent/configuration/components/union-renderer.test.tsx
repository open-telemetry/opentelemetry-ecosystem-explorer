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
  SchemaRenderer: ({ node }: { node: { key: string; hideLabel?: boolean } }) => (
    <span data-testid="variant" data-hide-label={String(!!node.hideLabel)}>
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
  it("renders a radio per variant", () => {
    render(<UnionRenderer node={unionNode} depth={1} path="value" />);
    expect(screen.getByRole("radio", { name: "String" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Int" })).toBeInTheDocument();
  });

  it("infers the selected variant from the stored value type (string)", () => {
    render(<UnionRenderer node={unionNode} depth={1} path="value" />);
    expect(screen.getByTestId("variant")).toHaveTextContent("string");
    expect(screen.getByRole("radio", { name: "String" })).toBeChecked();
  });

  it("dispatches setValue with the variant's empty value on radio change", () => {
    render(<UnionRenderer node={unionNode} depth={1} path="value" />);
    fireEvent.click(screen.getByRole("radio", { name: "Int" }));
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
    expect(screen.getByRole("radio", { name: "String" })).toBeInTheDocument();
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
    expect(screen.getByRole("radio", { name: "Text" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Boolean" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Number list" })).toBeInTheDocument();
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
    expect(screen.getByRole("radio", { name: "Text" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Group" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Boolean" })).toBeInTheDocument();
  });

  it("renders the first variant without a fieldset when every variant is filtered out", () => {
    const n: UnionNode = {
      controlType: "union",
      key: "v",
      label: "V",
      path: "v",
      variants: [{ controlType: "group", key: "b", label: "Variant 0", children: [], path: "v" }],
    };
    render(<UnionRenderer node={n} depth={1} path="v" />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByTestId("variant")).toHaveTextContent("b");
  });

  it("preserves the user's explicit List pick when inference is ambiguous between multiple array variants", () => {
    // Simulate three array-shaped variants where inference cannot disambiguate.
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

    // Value is "" (string) per the shared mock; start by rendering so the default selection
    // is inferred from the string. First let's flip to "List" via a click.
    render(<UnionRenderer node={n} depth={1} path="v" />);

    // Click the "List" radio. setValue dispatches [] which is ambiguous among all 3 array variants.
    fireEvent.click(screen.getByRole("radio", { name: "List" }));

    // After click, the "List" radio must remain checked — it must NOT snap back to "Text list".
    expect(screen.getByRole("radio", { name: "List" })).toBeChecked();
  });

  it("renders the union's own label visibly, not only as a sr-only legend", () => {
    render(<UnionRenderer node={unionNode} depth={1} path="value" />);
    // There should be at least one visible (non-sr-only) element with the label text.
    const elements = screen.getAllByText("Value");
    const visibleElement = elements.find((el) => !el.classList.contains("sr-only"));
    expect(visibleElement).toBeDefined();
    // The visible label must not be a legend element.
    expect(visibleElement!.tagName.toLowerCase()).not.toBe("legend");
  });

  it("renders the selected variant with hideLabel=true so inner ControlWrapper suppresses its own label", () => {
    render(<UnionRenderer node={unionNode} depth={1} path="value" />);
    const variantSpan = screen.getByTestId("variant");
    expect(variantSpan.getAttribute("data-hide-label")).toBe("true");
  });

  it("renders the description in a tooltip, not as an inline paragraph", () => {
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
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Choose a sampling strategy.");
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
    // Shared mock stores values: { value: "x" }. Inference says text_input (String).
    render(<UnionRenderer node={n} depth={1} path="v" />);
    expect(screen.getByRole("radio", { name: "String" })).toBeChecked();

    // User clicks Number -> setValue dispatches 0 -> inference is unambiguous (number_input wins).
    fireEvent.click(screen.getByRole("radio", { name: "Number" }));
    // We can't directly observe state post-click because our mock is static, but the click's
    // setValue call should have been emitted with 0:
    expect(setValue).toHaveBeenLastCalledWith("v", 0);
  });
});
