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
import { TextInputControl } from "./text-input-control";
import type { TextInputNode } from "@/types/configuration";

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

const node: TextInputNode = {
  controlType: "text_input",
  key: "endpoint",
  label: "Endpoint",
  path: "exporter.endpoint",
};

describe("TextInputControl", () => {
  beforeEach(() => {
    validateField.mockReset();
    mockValidationErrors = {};
  });

  it("renders input with current value", () => {
    render(
      <TextInputControl
        node={node}
        path={node.path}
        value="http://localhost:4317"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("textbox")).toHaveValue("http://localhost:4317");
  });

  it("renders empty input when value is null", () => {
    render(<TextInputControl node={node} path={node.path} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("calls onChange with path and new string value", () => {
    const onChange = vi.fn();
    render(<TextInputControl node={node} path={node.path} value="old" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "new" } });
    expect(onChange).toHaveBeenCalledWith("exporter.endpoint", "new");
  });

  it("calls onChange with empty string when cleared on nullable field (null only via Clear button)", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(
      <TextInputControl
        node={nullableNode}
        path={nullableNode.path}
        value="old"
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("exporter.endpoint", "");
  });

  it("calls onChange with empty string when cleared on non-nullable field", () => {
    const onChange = vi.fn();
    render(<TextInputControl node={node} path={node.path} value="old" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("exporter.endpoint", "");
  });

  it("renders an empty input + 'default' badge for nullable null value", () => {
    const nullableNode = { ...node, nullable: true };
    render(
      <TextInputControl
        node={nullableNode}
        path={nullableNode.path}
        value={null}
        onChange={vi.fn()}
      />
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(screen.getByText(/^default$/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set value/i })).toBeNull();
  });

  it("commits typed input directly without an activate step", () => {
    const onChange = vi.fn();
    const nullableNode = { ...node, nullable: true };
    render(
      <TextInputControl
        node={nullableNode}
        path={nullableNode.path}
        value={null}
        onChange={onChange}
      />
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "x" } });
    expect(onChange).toHaveBeenCalledWith("exporter.endpoint", "x");
  });

  it("links description to input via aria-describedby", () => {
    const nodeWithDesc = { ...node, description: "The collector URL" };
    render(
      <TextInputControl
        node={nodeWithDesc}
        path={nodeWithDesc.path}
        value="test"
        onChange={vi.fn()}
      />
    );
    const input = screen.getByRole("textbox");
    const descId = input.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId!)).toHaveTextContent("The collector URL");
  });

  it("calls validateField on blur and renders the error from state", () => {
    mockValidationErrors = { [node.path]: "Required" };
    render(<TextInputControl node={node} path={node.path} value="" onChange={vi.fn()} />);
    fireEvent.blur(screen.getByRole("textbox"));
    expect(validateField).toHaveBeenCalledWith(node.path);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});
