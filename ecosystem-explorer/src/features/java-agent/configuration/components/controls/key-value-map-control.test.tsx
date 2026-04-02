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
import { KeyValueMapControl } from "./key-value-map-control";
import type { KeyValueMapNode } from "@/types/configuration";

const node: KeyValueMapNode = {
  controlType: "key_value_map",
  key: "attributes",
  label: "Resource Attributes",
  path: "resource.attributes",
};

describe("KeyValueMapControl", () => {
  it("renders existing key and value inputs", () => {
    render(
      <KeyValueMapControl node={node} value={{ "service.name": "my-svc" }} onChange={vi.fn()} />
    );
    expect(screen.getByDisplayValue("service.name")).toBeInTheDocument();
    expect(screen.getByDisplayValue("my-svc")).toBeInTheDocument();
  });

  it("adds empty entry when Add clicked", () => {
    const onChange = vi.fn();
    render(<KeyValueMapControl node={node} value={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add entry to Resource Attributes" }));
    expect(onChange).toHaveBeenCalledWith("resource.attributes", { "": "" });
  });

  it("removes entry when X clicked", () => {
    const onChange = vi.fn();
    render(
      <KeyValueMapControl
        node={node}
        value={{ "service.name": "my-svc", env: "prod" }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove entry 1" }));
    expect(onChange).toHaveBeenCalledWith("resource.attributes", { env: "prod" });
  });

  it("updates key on input change", () => {
    const onChange = vi.fn();
    render(<KeyValueMapControl node={node} value={{ old: "val" }} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue("old"), { target: { value: "new" } });
    expect(onChange).toHaveBeenCalledWith("resource.attributes", { new: "val" });
  });

  it("updates value on input change", () => {
    const onChange = vi.fn();
    render(<KeyValueMapControl node={node} value={{ key: "old" }} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue("old"), { target: { value: "new" } });
    expect(onChange).toHaveBeenCalledWith("resource.attributes", { key: "new" });
  });

  it("does not auto-null when last entry removed on nullable node", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(<KeyValueMapControl node={nullableNode} value={{ key: "val" }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove entry 1" }));
    expect(onChange).toHaveBeenCalledWith("resource.attributes", {});
  });

  it("shows null state when nullable and value is null", () => {
    const nullableNode = { ...node, nullable: true };
    render(<KeyValueMapControl node={nullableNode} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Set value" })).toBeInTheDocument();
  });

  it("shows empty state text when value is empty object", () => {
    render(<KeyValueMapControl node={node} value={{}} onChange={vi.fn()} />);
    expect(screen.getByText("No entries")).toBeInTheDocument();
  });
});
