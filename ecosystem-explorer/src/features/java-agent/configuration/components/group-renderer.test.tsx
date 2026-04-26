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
import { GroupRenderer } from "./group-renderer";
import type { GroupNode } from "@/types/configuration";

const mockState: {
  values: Record<string, unknown>;
  enabledSections: Record<string, boolean>;
  validationErrors: Record<string, string>;
  version: string;
  isDirty: boolean;
} = {
  values: {},
  enabledSections: { resource: false },
  validationErrors: {},
  version: "1.0.0",
  isDirty: false,
};

const setEnabled = vi.fn();
const setValue = vi.fn();

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: mockState,
    setEnabled: (...a: unknown[]) => setEnabled(...a),
    setValue: (...a: unknown[]) => setValue(...a),
  }),
}));

const groupNode: GroupNode = {
  controlType: "group",
  key: "resource",
  label: "Resource",
  path: "resource",
  description: "The resource section",
  children: [],
};

describe("GroupRenderer", () => {
  it("at depth 0 renders a card with an enable switch", () => {
    render(<GroupRenderer node={groupNode} depth={0} path="resource" />);
    expect(screen.getByText("Resource")).toBeInTheDocument();
    const sw = screen.getByRole("switch", { name: /Enable Resource/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("at depth 0, flipping the switch dispatches setEnabled", () => {
    render(<GroupRenderer node={groupNode} depth={0} path="resource" />);
    fireEvent.click(screen.getByRole("switch", { name: /Enable Resource/i }));
    expect(setEnabled).toHaveBeenCalledWith("resource", true);
  });

  it("at depth >= 3 still renders a chevron button so the user can collapse the group", () => {
    render(<GroupRenderer node={groupNode} depth={3} path="resource" />);
    expect(screen.getByText("Resource")).toBeInTheDocument();
    // Collapsed by default at depth >= 1, so the chevron is in the "Expand" state.
    expect(screen.getByRole("button", { name: /Expand Resource/ })).toBeInTheDocument();
  });

  it("hides the chevron button at depth 0 when the section is disabled", () => {
    mockState.enabledSections.resource = false;
    render(<GroupRenderer node={groupNode} depth={0} path="resource" />);
    expect(screen.queryByRole("button", { name: /Expand Resource/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Collapse Resource/ })).not.toBeInTheDocument();
  });

  it("shows a labeled chevron button at depth 0 when the section is enabled", () => {
    mockState.enabledSections.resource = true;
    render(<GroupRenderer node={groupNode} depth={0} path="resource" />);
    expect(screen.getByRole("button", { name: /Collapse Resource/ })).toBeInTheDocument();
    mockState.enabledSections.resource = false; // restore for other tests
  });

  it("auto-expands the section when enabled flips from false to true", () => {
    mockState.enabledSections.resource = false;
    const childNode: GroupNode = {
      ...groupNode,
      children: [
        {
          controlType: "text_input",
          key: "schema_url",
          label: "Schema URL",
          path: "resource.schema_url",
        },
      ],
    };
    const { rerender } = render(<GroupRenderer node={childNode} depth={0} path="resource" />);
    // Initially disabled and collapsed — child label should not appear.
    expect(screen.queryByText("Schema URL")).not.toBeInTheDocument();

    // Flip enabled on and re-render with the same node reference.
    mockState.enabledSections.resource = true;
    rerender(<GroupRenderer node={childNode} depth={0} path="resource" />);

    // Child label should now appear (auto-expanded).
    expect(screen.getByText("Schema URL")).toBeInTheDocument();
    mockState.enabledSections.resource = false; // restore
  });

  it("at depth >= 1 always starts collapsed regardless of the value at the path", () => {
    // The starter populates processors[0].batch.schedule_delay, but the rule is "always
    // collapsed at depth >= 1" so the user sees the structure first instead of a wall
    // of pre-filled fields.
    const batchNode: GroupNode = {
      controlType: "group",
      key: "batch",
      label: "Batch",
      path: "tracer_provider.processors[0].batch",
      children: [
        {
          controlType: "text_input",
          key: "schedule_delay",
          label: "Schedule Delay",
          path: "tracer_provider.processors[0].batch.schedule_delay",
        } as unknown as GroupNode,
      ],
    };
    mockState.values = {
      tracer_provider: {
        processors: [{ batch: { exporter: { otlp_http: {} }, schedule_delay: 1000 } }],
      },
    };
    render(<GroupRenderer node={batchNode} depth={3} path="tracer_provider.processors[0].batch" />);
    expect(screen.queryByText("Schedule Delay")).toBeNull();
    // The chevron is there to expand on demand.
    expect(screen.getByRole("button", { name: /Expand Batch/ })).toBeInTheDocument();
  });

  it("at depth >= 1, expands when the chevron is clicked", () => {
    const samplerNode: GroupNode = {
      controlType: "group",
      key: "sampler",
      label: "Sampler",
      path: "tracer_provider.sampler",
      children: [
        {
          controlType: "text_input",
          key: "ratio",
          label: "Ratio",
          path: "tracer_provider.sampler.ratio",
        } as unknown as GroupNode,
      ],
    };
    mockState.values = {
      tracer_provider: { processors: [{ batch: { exporter: { otlp_http: {} } } }] },
    };
    render(<GroupRenderer node={samplerNode} depth={1} path="tracer_provider.sampler" />);
    expect(screen.queryByText("Ratio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Expand Sampler/ }));
    expect(screen.getByText("Ratio")).toBeInTheDocument();
  });

  it("at depth 0, exposes data-section-key and tabIndex for scroll-spy targeting", () => {
    mockState.enabledSections = { resource: true };
    const resourceNode: GroupNode = {
      controlType: "group",
      key: "resource",
      label: "Resource",
      path: "resource",
      children: [],
    };
    const { container } = render(<GroupRenderer node={resourceNode} depth={0} path="resource" />);
    const section = container.querySelector<HTMLElement>('[data-section-key="resource"]');
    expect(section).not.toBeNull();
    expect(section?.getAttribute("tabindex")).toBe("-1");
  });

  it("renders a TruncatedDescription on top-level cards (depth 0)", () => {
    mockState.enabledSections = { tracer: true };
    const node: GroupNode = {
      controlType: "group",
      key: "tracer",
      label: "Tracer Provider",
      path: "tracer",
      description: "Configure spans, samplers, and processors. Multiple processors are supported.",
      children: [],
    };
    render(<GroupRenderer node={node} depth={0} path="tracer" />);
    expect(screen.getByText("Configure spans, samplers, and processors.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });

  it("renders a tooltip for nested groups (depth >= 1) instead of an inline paragraph", () => {
    const node: GroupNode = {
      controlType: "group",
      key: "batch",
      label: "Batch",
      path: "tracer.processors[0].batch",
      description: "Batch span processor.",
      children: [],
    };
    render(<GroupRenderer node={node} depth={1} path="tracer.processors[0].batch" />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Batch span processor.");
    const allMatches = screen.getAllByText("Batch span processor.");
    expect(allMatches).toHaveLength(1);
  });
});
