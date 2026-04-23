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
import { PluginSelectRenderer } from "./plugin-select-renderer";
import type { PluginSelectNode } from "@/types/configuration";

const selectPlugin = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockConfigState: any = {
  values: { exporter: { otlp_http: {} } },
  enabledSections: {},
  validationErrors: {},
  version: "1.0.0",
  isDirty: false,
};

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: mockConfigState,
    setValue: vi.fn(),
    setEnabled: vi.fn(),
    selectPlugin: (...a: unknown[]) => selectPlugin(...a),
  }),
}));

vi.mock("./schema-renderer", () => ({
  SchemaRenderer: ({ path }: { path: string }) => <span data-testid="body-path">{path}</span>,
}));

const pluginNode: PluginSelectNode = {
  controlType: "plugin_select",
  key: "exporter",
  label: "Exporter",
  path: "exporter",
  allowCustom: false,
  options: [
    {
      controlType: "group",
      key: "otlp_http",
      label: "OTLP HTTP",
      path: "exporter.otlp_http",
      children: [],
    },
    {
      controlType: "flag",
      key: "console",
      label: "Console",
      path: "exporter.console",
    },
  ],
};

const pluginNodeWithCustom: PluginSelectNode = {
  controlType: "plugin_select",
  key: "exporter",
  label: "Exporter",
  path: "exporter",
  allowCustom: true,
  options: [
    {
      controlType: "group",
      key: "otlp_http",
      label: "OTLP HTTP",
      path: "exporter.otlp_http",
      children: [],
    },
    {
      controlType: "flag",
      key: "console",
      label: "Console",
      path: "exporter.console",
    },
  ],
};

describe("PluginSelectRenderer", () => {
  beforeEach(() => {
    selectPlugin.mockReset();
    mockConfigState.values = { exporter: { otlp_http: {} } };
  });

  it("renders a select with variant labels and the body for the selected variant", () => {
    render(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("OTLP HTTP")).toBeInTheDocument();
    expect(screen.getByText("Console")).toBeInTheDocument();
    expect(screen.getByTestId("body-path")).toHaveTextContent("exporter.otlp_http");
  });

  it("dispatches selectPlugin on change", () => {
    render(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "console" } });
    expect(selectPlugin).toHaveBeenCalledWith("exporter", "console");
  });

  it("shows 'Custom: <key>' in the select when a custom plugin is committed", () => {
    mockConfigState.values = { exporter: { "my-exporter": {} } };
    render(<PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />);
    const select = screen.getByRole("combobox", { name: "Exporter variant" }) as HTMLSelectElement;
    expect(select.value).toBe("__custom__");
    const selectedOption = select.options[select.selectedIndex];
    expect(selectedOption.textContent).toBe("Custom: my-exporter");
  });

  it("auto-focuses the custom-name input when the picker opens", () => {
    mockConfigState.values = { exporter: {} };
    render(<PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />);
    fireEvent.change(screen.getByRole("combobox", { name: "Exporter variant" }), {
      target: { value: "__custom__" },
    });
    const input = screen.getByRole("textbox", { name: "Custom plugin name" });
    expect(document.activeElement).toBe(input);
  });
});
