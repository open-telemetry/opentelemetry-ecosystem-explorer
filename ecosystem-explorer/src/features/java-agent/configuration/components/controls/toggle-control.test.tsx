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
import { ToggleControl } from "./toggle-control";
import type { ToggleNode } from "@/types/configuration";

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

const node: ToggleNode = {
  controlType: "toggle",
  key: "enabled",
  label: "Enabled",
  path: "exporter.enabled",
};

describe("ToggleControl", () => {
  beforeEach(() => {
    validateField.mockReset();
    mockValidationErrors = {};
  });

  it("renders switch as checked when value is true", () => {
    render(<ToggleControl node={node} path={node.path} value={true} onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("renders switch as unchecked when value is false", () => {
    render(<ToggleControl node={node} path={node.path} value={false} onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with path and toggled value when clicked", () => {
    const onChange = vi.fn();
    render(<ToggleControl node={node} path={node.path} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith("exporter.enabled", true);
  });

  it("calls onChange with false when toggled from true", () => {
    const onChange = vi.fn();
    render(<ToggleControl node={node} path={node.path} value={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith("exporter.enabled", false);
  });

  it("renders the switch in the inferred default position when value is null and default is true", () => {
    const nullable: ToggleNode = { ...node, nullable: true, defaultBehavior: "true is used" };
    render(<ToggleControl node={nullable} path={nullable.path} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch")).toHaveAttribute("data-variant", "dashed");
    expect(screen.getByText(/^default$/i)).toBeInTheDocument();
  });

  it("clicking the default-on switch commits explicit false", () => {
    const onChange = vi.fn();
    const nullable: ToggleNode = { ...node, nullable: true, defaultBehavior: "true is used" };
    render(<ToggleControl node={nullable} path={nullable.path} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith("exporter.enabled", false);
  });

  it("clicking the default-off switch commits explicit true", () => {
    const onChange = vi.fn();
    const nullable: ToggleNode = {
      ...node,
      key: "insecure",
      label: "Insecure",
      path: "exporter.insecure",
      nullable: true,
      defaultBehavior: "false is used",
    };
    render(<ToggleControl node={nullable} path={nullable.path} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith("exporter.insecure", true);
  });

  it("falls back to OFF when default is unparseable, still showing the default badge", () => {
    const nullable: ToggleNode = {
      ...node,
      key: "trace_based",
      label: "Trace based",
      path: "p.trace_based",
      nullable: true,
      defaultBehavior: "trace based filtering is not applied",
    };
    render(<ToggleControl node={nullable} path={nullable.path} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch")).toHaveAttribute("data-variant", "dashed");
    expect(screen.getByText(/^default$/i)).toBeInTheDocument();
  });

  it("renders a Reset link when value is set, clicking returns to null", () => {
    const onChange = vi.fn();
    const nullable: ToggleNode = { ...node, nullable: true, defaultBehavior: "true is used" };
    render(
      <ToggleControl node={nullable} path={nullable.path} value={false} onChange={onChange} />
    );
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(onChange).toHaveBeenCalledWith("exporter.enabled", null);
  });

  it("renders the error from state when validationErrors has this path", () => {
    mockValidationErrors = { [node.path]: "Required" };
    render(<ToggleControl node={node} path={node.path} value={false} onChange={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("renders the switch on the same row as the label", () => {
    render(<ToggleControl node={node} path={node.path} value={true} onChange={vi.fn()} />);
    const label = screen.getByText("Enabled");
    const sw = screen.getByRole("switch");
    expect(label.closest("div")).toBe(sw.closest("div"));
  });
});
