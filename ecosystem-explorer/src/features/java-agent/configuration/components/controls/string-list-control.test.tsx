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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StringListControl } from "./string-list-control";
import type { StringListNode } from "@/types/configuration";

const validateField = vi.fn();
let mockValidationErrors: Record<string, string> = {};

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: {
      values: {},
      enabledSections: {},
      validationErrors: mockValidationErrors,
      version: "1.0.0",
      isDirty: false,
    },
    validateField,
    setValue: vi.fn(),
  }),
}));

const node: StringListNode = {
  controlType: "string_list",
  key: "headers",
  label: "Headers",
  path: "exporter.headers",
};

describe("StringListControl", () => {
  beforeEach(() => {
    validateField.mockReset();
    mockValidationErrors = {};
  });

  it("renders existing items", () => {
    render(
      <StringListControl
        node={node}
        path={node.path}
        value={["Authorization", "Content-Type"]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("Authorization")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Content-Type")).toBeInTheDocument();
  });

  it("adds an empty item when Add clicked", () => {
    const onChange = vi.fn();
    render(
      <StringListControl node={node} path={node.path} value={["existing"]} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Add item to Headers" }));
    expect(onChange).toHaveBeenCalledWith("exporter.headers", ["existing", ""]);
  });

  it("removes item when X clicked", () => {
    const onChange = vi.fn();
    render(
      <StringListControl node={node} path={node.path} value={["a", "b"]} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onChange).toHaveBeenCalledWith("exporter.headers", ["b"]);
  });

  it("updates item value on input change", () => {
    const onChange = vi.fn();
    render(<StringListControl node={node} path={node.path} value={["old"]} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue("old"), { target: { value: "new" } });
    expect(onChange).toHaveBeenCalledWith("exporter.headers", ["new"]);
  });

  it("hides Add button when maxItems reached", () => {
    const constrainedNode = { ...node, constraints: { maxItems: 2 } };
    render(
      <StringListControl
        node={constrainedNode}
        path={constrainedNode.path}
        value={["a", "b"]}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "Add item to Headers" })).not.toBeInTheDocument();
  });

  it("does not auto-null when last item removed on nullable node", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(
      <StringListControl
        node={nullableNode}
        path={nullableNode.path}
        value={["only"]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onChange).toHaveBeenCalledWith("exporter.headers", []);
  });

  it("shows the 'default' badge for nullable null value (no Set value interstitial)", () => {
    const nullableNode = { ...node, nullable: true };
    render(
      <StringListControl
        node={nullableNode}
        path={nullableNode.path}
        value={null}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/^default$/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set value/i })).toBeNull();
  });

  it("renders the error from state when validationErrors has this path", () => {
    mockValidationErrors = { [node.path]: "Required" };
    render(<StringListControl node={node} path={node.path} value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});
