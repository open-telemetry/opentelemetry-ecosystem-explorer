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
import { SelectControl } from "./select-control";
import type { SelectNode } from "@/types/configuration";

const node: SelectNode = {
  controlType: "select",
  key: "compression",
  label: "Compression",
  path: "exporter.compression",
  enumOptions: [
    { value: "none", description: "No compression" },
    { value: "gzip", description: "gzip compression" },
  ],
};

describe("SelectControl", () => {
  it("renders all enum options", () => {
    render(<SelectControl node={node} value="none" onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "none" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "gzip" })).toBeInTheDocument();
  });

  it("renders with selected value", () => {
    render(<SelectControl node={node} value="gzip" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("gzip");
  });

  it("calls onChange with path and selected value", () => {
    const onChange = vi.fn();
    render(<SelectControl node={node} value="none" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "gzip" } });
    expect(onChange).toHaveBeenCalledWith("exporter.compression", "gzip");
  });

  it("includes a default option when nullable", () => {
    const nullableNode = { ...node, nullable: true, defaultBehavior: "No compression" };
    render(<SelectControl node={nullableNode} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "No compression" })).toBeInTheDocument();
  });

  it("calls onChange with null when default option selected on nullable field", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(<SelectControl node={nullableNode} value="gzip" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("exporter.compression", null);
  });

  it("renders label from ControlWrapper", () => {
    render(<SelectControl node={node} value="none" onChange={vi.fn()} />);
    expect(screen.getByText("Compression")).toBeInTheDocument();
  });

  it("links description to select via aria-describedby", () => {
    const nodeWithDesc = { ...node, description: "Compression algorithm" };
    render(<SelectControl node={nodeWithDesc} value="none" onChange={vi.fn()} />);
    const select = screen.getByRole("combobox");
    const descId = select.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId!)).toHaveTextContent("Compression algorithm");
  });
});
