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
import { StringListControl } from "./string-list-control";
import type { StringListNode } from "@/types/configuration";

const node: StringListNode = {
  controlType: "string_list",
  key: "headers",
  label: "Headers",
  path: "exporter.headers",
};

describe("StringListControl", () => {
  it("renders existing items", () => {
    render(
      <StringListControl node={node} value={["Authorization", "Content-Type"]} onChange={vi.fn()} />
    );
    expect(screen.getByDisplayValue("Authorization")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Content-Type")).toBeInTheDocument();
  });

  it("adds an empty item when Add clicked", () => {
    const onChange = vi.fn();
    render(<StringListControl node={node} value={["existing"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add item to Headers" }));
    expect(onChange).toHaveBeenCalledWith("exporter.headers", ["existing", ""]);
  });

  it("removes item when X clicked", () => {
    const onChange = vi.fn();
    render(<StringListControl node={node} value={["a", "b"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onChange).toHaveBeenCalledWith("exporter.headers", ["b"]);
  });

  it("updates item value on input change", () => {
    const onChange = vi.fn();
    render(<StringListControl node={node} value={["old"]} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue("old"), { target: { value: "new" } });
    expect(onChange).toHaveBeenCalledWith("exporter.headers", ["new"]);
  });

  it("hides Add button when maxItems reached", () => {
    const constrainedNode = { ...node, constraints: { maxItems: 2 } };
    render(<StringListControl node={constrainedNode} value={["a", "b"]} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Add item to Headers" })).not.toBeInTheDocument();
  });

  it("shows range constraint hint", () => {
    const constrainedNode = { ...node, constraints: { minItems: 1, maxItems: 5 } };
    render(<StringListControl node={constrainedNode} value={["a"]} onChange={vi.fn()} />);
    expect(screen.getByText("1–5 items")).toBeInTheDocument();
  });

  it("does not auto-null when last item removed on nullable node", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(<StringListControl node={nullableNode} value={["only"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onChange).toHaveBeenCalledWith("exporter.headers", []);
  });

  it("shows null state when nullable and value is null", () => {
    const nullableNode = { ...node, nullable: true };
    render(<StringListControl node={nullableNode} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Set value" })).toBeInTheDocument();
  });
});
