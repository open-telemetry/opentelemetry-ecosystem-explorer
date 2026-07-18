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
import { type ReactElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PluginSelectRenderer } from "./plugin-select-renderer";
import { ListItemContext } from "./configuration-ui-context";
import type { PluginSelectNode } from "@/types/configuration";

const selectPlugin = vi.fn();
const setValue = vi.fn();
const mockConfigState = {
  values: { exporter: { otlp_http: {} } } as Record<string, unknown>,
  enabledSections: {},
  validationErrors: {},
  version: "1.0.0",
  isDirty: false,
};

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: mockConfigState,
    setValue: (...a: unknown[]) => setValue(...a),
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

const pluginNodeWithCustom: PluginSelectNode = { ...pluginNode, allowCustom: true };

function renderInsideListItem(ui: ReactElement) {
  return render(<ListItemContext.Provider value={true}>{ui}</ListItemContext.Provider>);
}

describe("PluginSelectRenderer — inside list item", () => {
  beforeEach(() => {
    selectPlugin.mockReset();
    setValue.mockReset();
    mockConfigState.values = { exporter: { otlp_http: {} } };
  });

  it("renders tabs directly with no chevron row", () => {
    renderInsideListItem(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["OTLP HTTP", "Console"]);
  });

  it("dispatches selectPlugin when a tab is clicked", () => {
    renderInsideListItem(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    fireEvent.click(screen.getByRole("tab", { name: "Console" }));
    expect(selectPlugin).toHaveBeenCalledWith("exporter", "console");
  });

  it("renders the selected option body", () => {
    renderInsideListItem(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    expect(screen.getByTestId("body-path")).toHaveTextContent("exporter.otlp_http");
  });

  it("supports custom plugin selection", () => {
    mockConfigState.values = { exporter: {} };
    renderInsideListItem(
      <PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Custom…" }));
    expect(screen.getByRole("textbox", { name: "Custom plugin name" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Console" }));
    expect(screen.queryByRole("textbox", { name: "Custom plugin name" })).not.toBeInTheDocument();
  });

  it("hides the previously-selected option body while the custom picker is open", () => {
    mockConfigState.values = { exporter: { otlp_http: {} } };
    renderInsideListItem(
      <PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />
    );
    expect(screen.getByTestId("body-path")).toHaveTextContent("exporter.otlp_http");
    fireEvent.click(screen.getByRole("tab", { name: "Custom…" }));
    expect(screen.queryByTestId("body-path")).toBeNull();
  });

  it("live-updates the selection on every keystroke", () => {
    mockConfigState.values = { exporter: { otlp_http: {} } };
    renderInsideListItem(
      <PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Custom…" }));
    const input = screen.getByRole("textbox", { name: "Custom plugin name" });
    fireEvent.change(input, { target: { value: "my" } });
    fireEvent.change(input, { target: { value: "myname" } });
    expect(selectPlugin).toHaveBeenNthCalledWith(1, "exporter", "my");
    expect(selectPlugin).toHaveBeenNthCalledWith(2, "exporter", "myname");
  });

  it("Cancel restores the previously-selected subtree exactly (preserves user edits)", () => {
    mockConfigState.values = { exporter: { otlp_http: { endpoint: "http://x" } } };
    renderInsideListItem(
      <PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Custom…" }));
    const input = screen.getByRole("textbox", { name: "Custom plugin name" });
    fireEvent.change(input, { target: { value: "myname" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(setValue).toHaveBeenCalledWith("exporter", { otlp_http: { endpoint: "http://x" } });
  });

  it("Cancel from a no-prior-selection state clears the path", () => {
    mockConfigState.values = { exporter: null };
    renderInsideListItem(
      <PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Custom…" }));
    const input = screen.getByRole("textbox", { name: "Custom plugin name" });
    fireEvent.change(input, { target: { value: "myname" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(setValue).toHaveBeenCalledWith("exporter", null);
  });

  it("Cancel without any keystroke is a no-op (does not call setValue)", () => {
    mockConfigState.values = { exporter: { otlp_http: {} } };
    renderInsideListItem(
      <PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Custom…" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(setValue).not.toHaveBeenCalled();
  });

  it("returns focus to the Custom tab after Cancel or Done", () => {
    mockConfigState.values = { exporter: { otlp_http: {} } };
    renderInsideListItem(
      <PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />
    );
    const customTab = screen.getByRole("tab", { name: "Custom…" });
    fireEvent.click(customTab);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(customTab);

    fireEvent.click(customTab);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(document.activeElement).toBe(customTab);
  });

  it("the Custom picker is a tabpanel labelled by the Custom tab", () => {
    mockConfigState.values = { exporter: { otlp_http: {} } };
    renderInsideListItem(
      <PluginSelectRenderer node={pluginNodeWithCustom} depth={1} path="exporter" />
    );
    const customTab = screen.getByRole("tab", { name: "Custom…" });
    fireEvent.click(customTab);
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(customTab.id);
    expect(customTab.getAttribute("aria-controls")).toBe(panel.id);
  });

  it("reserves right-side padding on the tablist so the absolute remove button does not overlap tabs", () => {
    renderInsideListItem(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    const tablist = screen.getByRole("tablist", { name: "Exporter variant" });
    expect(tablist.className).toMatch(/\bpr-10\b/);
  });
});

describe("PluginSelectRenderer — standalone at depth >= 1", () => {
  beforeEach(() => {
    selectPlugin.mockReset();
    mockConfigState.values = { exporter: { otlp_http: {} } };
  });

  it("starts collapsed and shows a chevron, no tablist", () => {
    render(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Expand Exporter/ })).toBeInTheDocument();
  });

  it("reveals the tablist after expanding", () => {
    render(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    fireEvent.click(screen.getByRole("button", { name: /Expand Exporter/ }));
    expect(screen.getAllByRole("tab").length).toBeGreaterThan(0);
  });

  it("does not reserve right-side padding when not inside a list item", () => {
    render(<PluginSelectRenderer node={pluginNode} depth={1} path="exporter" />);
    fireEvent.click(screen.getByRole("button", { name: /Expand Exporter/ }));
    const tablist = screen.getByRole("tablist", { name: "Exporter variant" });
    expect(tablist.className).not.toMatch(/\bpr-10\b/);
  });

  it("does not duplicate the description icon when the chevron row already shows it", () => {
    const nodeWithDesc: PluginSelectNode = { ...pluginNode, description: "Choose the exporter." };
    render(<PluginSelectRenderer node={nodeWithDesc} depth={1} path="exporter" />);
    fireEvent.click(screen.getByRole("button", { name: /Expand Exporter/ }));
    expect(screen.getAllByText("Choose the exporter.")).toHaveLength(1);
  });
});
