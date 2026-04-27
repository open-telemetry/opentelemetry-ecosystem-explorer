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

  it("renders one tab per variant, marks the selected one, and shows its body", () => {
    render(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["OTLP HTTP", "Console"]);
    const otlp = screen.getByRole("tab", { name: "OTLP HTTP" });
    expect(otlp).toHaveAttribute("aria-selected", "true");
    const console = screen.getByRole("tab", { name: "Console" });
    expect(console).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("body-path")).toHaveTextContent("exporter.otlp_http");
  });

  it("dispatches selectPlugin when a tab is clicked", () => {
    render(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    fireEvent.click(screen.getByRole("tab", { name: "Console" }));
    expect(selectPlugin).toHaveBeenCalledWith("exporter", "console");
  });

  it("renders a 'Custom: <key>' tab when a custom plugin is committed", () => {
    mockConfigState.values = { exporter: { "my-exporter": {} } };
    render(<PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />);
    const customTab = screen.getByRole("tab", { name: "Custom: my-exporter" });
    expect(customTab).toHaveAttribute("aria-selected", "true");
  });

  it("auto-focuses the custom-name input when the Custom… tab is clicked", () => {
    mockConfigState.values = { exporter: {} };
    render(<PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />);
    fireEvent.click(screen.getByRole("tab", { name: "Custom…" }));
    const input = screen.getByRole("textbox", { name: "Custom plugin name" });
    expect(document.activeElement).toBe(input);
  });

  it("highlights the Custom… tab when the picker is open and deactivates other tabs", () => {
    mockConfigState.values = { exporter: { otlp_http: {} } };
    render(<PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />);
    expect(screen.getByRole("tab", { name: "OTLP HTTP" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Custom…" }));

    expect(screen.getByRole("tab", { name: "Custom…" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "OTLP HTTP" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("tab", { name: "Console" })).toHaveAttribute("aria-selected", "false");
  });

  it("closes the Custom picker and clears the draft when a sibling tab is clicked", () => {
    mockConfigState.values = { exporter: {} };
    render(<PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />);
    fireEvent.click(screen.getByRole("tab", { name: "Custom…" }));
    expect(screen.getByRole("textbox", { name: "Custom plugin name" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Console" }));

    expect(screen.queryByRole("textbox", { name: "Custom plugin name" })).not.toBeInTheDocument();
    expect(selectPlugin).toHaveBeenCalledWith("exporter", "console");
  });

  it("pre-fills the picker with the existing custom value when re-opened", () => {
    mockConfigState.values = { exporter: { "my-exporter": {} } };
    render(<PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />);
    fireEvent.click(screen.getByRole("tab", { name: "Custom: my-exporter" }));
    const input = screen.getByRole("textbox", {
      name: "Custom plugin name",
    }) as HTMLInputElement;
    expect(input.value).toBe("my-exporter");
  });

  it("renders the plugin-select description in a tooltip inside the tablist", () => {
    const nodeWithDesc: PluginSelectNode = {
      ...pluginNode,
      description: "Choose the exporter variant.",
    };
    mockConfigState.values = { exporter: { otlp_http: {} } };
    render(<PluginSelectRenderer node={nodeWithDesc} depth={1} path="exporter" />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Choose the exporter variant.");
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getAllByText("Choose the exporter variant.")).toHaveLength(1);
  });
});
