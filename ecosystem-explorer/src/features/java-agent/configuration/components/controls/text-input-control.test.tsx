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
import { TextInputControl } from "./text-input-control";
import type { TextInputNode } from "@/types/configuration";

const node: TextInputNode = {
  controlType: "text_input",
  key: "endpoint",
  label: "Endpoint",
  path: "exporter.endpoint",
};

describe("TextInputControl", () => {
  it("renders input with current value", () => {
    render(<TextInputControl node={node} value="http://localhost:4317" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("http://localhost:4317");
  });

  it("renders empty input when value is null", () => {
    render(<TextInputControl node={node} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("calls onChange with path and new string value", () => {
    const onChange = vi.fn();
    render(<TextInputControl node={node} value="old" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "new" } });
    expect(onChange).toHaveBeenCalledWith("exporter.endpoint", "new");
  });

  it("calls onChange with empty string when cleared on nullable field (null only via Clear button)", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(<TextInputControl node={nullableNode} value="old" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("exporter.endpoint", "");
  });

  it("calls onChange with empty string when cleared on non-nullable field", () => {
    const onChange = vi.fn();
    render(<TextInputControl node={node} value="old" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("exporter.endpoint", "");
  });

  it("shows null state for nullable null value", () => {
    const nullableNode = { ...node, nullable: true };
    render(<TextInputControl node={nullableNode} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Set value" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("activates with empty string when Set value clicked", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(<TextInputControl node={nullableNode} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Set value" }));
    expect(onChange).toHaveBeenCalledWith("exporter.endpoint", "");
  });

  it("links description to input via aria-describedby", () => {
    const nodeWithDesc = { ...node, description: "The collector URL" };
    render(<TextInputControl node={nodeWithDesc} value="test" onChange={vi.fn()} />);
    const input = screen.getByRole("textbox");
    const descId = input.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId!)).toHaveTextContent("The collector URL");
  });
});
