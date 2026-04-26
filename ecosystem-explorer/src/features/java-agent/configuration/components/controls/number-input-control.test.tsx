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
import { NumberInputControl } from "./number-input-control";
import type { NumberInputNode } from "@/types/configuration";

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

const node: NumberInputNode = {
  controlType: "number_input",
  key: "timeout",
  label: "Timeout",
  path: "exporter.timeout",
};

describe("NumberInputControl", () => {
  beforeEach(() => {
    validateField.mockReset();
    mockValidationErrors = {};
  });

  it("renders input with current value", () => {
    render(<NumberInputControl node={node} path={node.path} value={5000} onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(5000);
  });

  it("renders empty input when value is null", () => {
    render(<NumberInputControl node={node} path={node.path} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(null);
  });

  it("calls onChange with path and parsed number", () => {
    const onChange = vi.fn();
    render(<NumberInputControl node={node} path={node.path} value={0} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3000" } });
    expect(onChange).toHaveBeenCalledWith("exporter.timeout", 3000);
  });

  it("renders an empty input + 'default' badge for nullable null value", () => {
    const nullableNode = { ...node, nullable: true };
    render(
      <NumberInputControl
        node={nullableNode}
        path={nullableNode.path}
        value={null}
        onChange={vi.fn()}
      />
    );
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(screen.getByText(/^default$/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set value/i })).toBeNull();
  });

  it("does not commit 0 when the user clears a non-empty field", () => {
    const onChange = vi.fn();
    render(<NumberInputControl node={node} path={node.path} value={5000} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("links description to input via aria-describedby", () => {
    const nodeWithDesc = { ...node, description: "Max wait time" };
    render(
      <NumberInputControl
        node={nodeWithDesc}
        path={nodeWithDesc.path}
        value={5000}
        onChange={vi.fn()}
      />
    );
    const input = screen.getByRole("spinbutton");
    const descId = input.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId!)).toHaveTextContent("Max wait time");
  });

  it("calls validateField on blur and renders the error from state", () => {
    mockValidationErrors = { [node.path]: "Required" };
    render(<NumberInputControl node={node} path={node.path} value={0} onChange={vi.fn()} />);
    fireEvent.blur(screen.getByRole("spinbutton"));
    expect(validateField).toHaveBeenCalledWith(node.path);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("allows typing to replace a committed zero", () => {
    const onChange = vi.fn();
    render(<NumberInputControl node={node} path={node.path} value={0} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "7" } });
    expect(onChange).toHaveBeenLastCalledWith("exporter.timeout", 7);
    expect(screen.getByRole("spinbutton")).toHaveValue(7);
  });

  it("restores the committed value on blur when the draft is empty", () => {
    const onChange = vi.fn();
    render(<NumberInputControl node={node} path={node.path} value={42} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue(null);
    fireEvent.blur(input);
    expect(input).toHaveValue(42);
  });

  it("syncs the draft when the external value changes", () => {
    const { rerender } = render(
      <NumberInputControl node={node} path={node.path} value={1} onChange={vi.fn()} />
    );
    expect(screen.getByRole("spinbutton")).toHaveValue(1);
    rerender(<NumberInputControl node={node} path={node.path} value={99} onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(99);
  });
});
