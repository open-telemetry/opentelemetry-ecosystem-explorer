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
import { NumberListControl } from "./number-list-control";
import type { NumberListNode } from "@/types/configuration";

const node: NumberListNode = {
  controlType: "number_list",
  key: "ports",
  label: "Ports",
  path: "receiver.ports",
};

describe("NumberListControl", () => {
  it("renders existing items", () => {
    render(<NumberListControl node={node} value={[4317, 4318]} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("4317")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4318")).toBeInTheDocument();
  });

  it("adds item with value 0 when Add clicked", () => {
    const onChange = vi.fn();
    render(<NumberListControl node={node} value={[4317]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add item to Ports" }));
    expect(onChange).toHaveBeenCalledWith("receiver.ports", [4317, 0]);
  });

  it("removes item when X clicked", () => {
    const onChange = vi.fn();
    render(<NumberListControl node={node} value={[4317, 4318]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onChange).toHaveBeenCalledWith("receiver.ports", [4318]);
  });

  it("updates item value on input change", () => {
    const onChange = vi.fn();
    render(<NumberListControl node={node} value={[4317]} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue("4317"), { target: { value: "8080" } });
    expect(onChange).toHaveBeenCalledWith("receiver.ports", [8080]);
  });

  it("emits 0 when input is cleared (allows retyping)", () => {
    const onChange = vi.fn();
    render(<NumberListControl node={node} value={[4317]} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue("4317"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("receiver.ports", [0]);
  });

  it("hides Add button when maxItems reached", () => {
    const constrainedNode = { ...node, constraints: { maxItems: 1 } };
    render(<NumberListControl node={constrainedNode} value={[4317]} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Add item to Ports" })).not.toBeInTheDocument();
  });

  it("does not auto-null when last item removed on nullable node", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(<NumberListControl node={nullableNode} value={[4317]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onChange).toHaveBeenCalledWith("receiver.ports", []);
  });

  it("shows null state when nullable and value is null", () => {
    const nullableNode = { ...node, nullable: true };
    render(<NumberListControl node={nullableNode} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Set value" })).toBeInTheDocument();
  });
});
