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
import { NumberInputControl } from "./number-input-control";
import type { NumberInputNode } from "@/types/configuration";

const node: NumberInputNode = {
  controlType: "number_input",
  key: "timeout",
  label: "Timeout",
  path: "exporter.timeout",
};

describe("NumberInputControl", () => {
  it("renders input with current value", () => {
    render(<NumberInputControl node={node} value={5000} onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(5000);
  });

  it("renders empty input when value is null", () => {
    render(<NumberInputControl node={node} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(null);
  });

  it("calls onChange with path and parsed number", () => {
    const onChange = vi.fn();
    render(<NumberInputControl node={node} value={0} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3000" } });
    expect(onChange).toHaveBeenCalledWith("exporter.timeout", 3000);
  });

  it("shows range hint when both minimum and maximum are set", () => {
    const constrainedNode = { ...node, constraints: { minimum: 1, maximum: 60000 } };
    render(<NumberInputControl node={constrainedNode} value={5000} onChange={vi.fn()} />);
    expect(screen.getByText("Range: 1–60000")).toBeInTheDocument();
  });

  it("shows minimum hint when only minimum is set", () => {
    const constrainedNode = { ...node, constraints: { minimum: 1 } };
    render(<NumberInputControl node={constrainedNode} value={5000} onChange={vi.fn()} />);
    expect(screen.getByText("Minimum: 1")).toBeInTheDocument();
  });

  it("shows null state for nullable null value", () => {
    const nullableNode = { ...node, nullable: true };
    render(<NumberInputControl node={nullableNode} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Set value" })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("activates with 0 when Set value clicked", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(<NumberInputControl node={nullableNode} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Set value" }));
    expect(onChange).toHaveBeenCalledWith("exporter.timeout", 0);
  });

  it("emits 0 when clearing nullable field instead of flipping to null state", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(<NumberInputControl node={nullableNode} value={5000} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("exporter.timeout", 0);
  });

  it("shows exclusive minimum hint as 'Greater than'", () => {
    const constrainedNode = { ...node, constraints: { exclusiveMinimum: 0 } };
    render(<NumberInputControl node={constrainedNode} value={5} onChange={vi.fn()} />);
    expect(screen.getByText("Greater than 0")).toBeInTheDocument();
  });

  it("links description to input via aria-describedby", () => {
    const nodeWithDesc = { ...node, description: "Max wait time" };
    render(<NumberInputControl node={nodeWithDesc} value={5000} onChange={vi.fn()} />);
    const input = screen.getByRole("spinbutton");
    const descId = input.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId!)).toHaveTextContent("Max wait time");
  });
});
