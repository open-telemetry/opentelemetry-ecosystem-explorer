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
import type { InstrumentationListEntry, InstrumentationModule } from "@/types/javaagent";
import { InstrumentationRow } from "./instrumentation-row";

vi.mock("./instrumentation-config-form", () => ({
  InstrumentationConfigForm: ({ module: m }: { module: { name: string } }) => (
    <div data-testid={`form-stub-${m.name}`} />
  ),
}));

function entry(
  name: string,
  opts: Partial<InstrumentationListEntry> = {}
): InstrumentationListEntry {
  return {
    name,
    scope: { name: `io.opentelemetry.${name}` },
    ...opts,
  } as InstrumentationListEntry;
}

function moduleFixture(
  name: string,
  coveredEntries: InstrumentationListEntry[],
  defaultDisabled = false
): InstrumentationModule {
  return { name, defaultDisabled, coveredEntries };
}

const expansionDefaults = {
  isExpanded: false,
  onToggleExpand: vi.fn(),
  onJumpToGeneral: vi.fn(),
} as const;

describe("InstrumentationRow", () => {
  it("renders the module name as the primary label", () => {
    render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-3.0"), entry("cassandra-4.4")])}
        status="none"
        onSetEnabled={() => {}}
        onRemoveCustomization={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.getByText(/2 versions/)).toBeInTheDocument();
  });

  it("shows only Enabled for default-enabled modules (no default text)", () => {
    render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="none"
        onSetEnabled={() => {}}
        onRemoveCustomization={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.queryByText("enabled by default")).toBeNull();
  });

  it("shows only Disabled for default-disabled modules (no default text)", () => {
    render(
      <InstrumentationRow
        module={moduleFixture("jmx_metrics", [entry("jmx-metrics")], true)}
        status="none"
        onSetEnabled={() => {}}
        onRemoveCustomization={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.queryByText("disabled by default")).toBeNull();
  });

  it("shows Default metadata when customized state differs from default", () => {
    render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="disabled"
        onSetEnabled={() => {}}
        onRemoveCustomization={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText("enabled by default")).toBeInTheDocument();
  });

  it("calls onToggleExpand when the header row is clicked", () => {
    const onToggle = vi.fn();
    render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="none"
        onSetEnabled={() => {}}
        onRemoveCustomization={() => {}}
        {...expansionDefaults}
        onToggleExpand={onToggle}
      />
    );
    fireEvent.click(screen.getByText("cassandra"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("renders the toggle and Reset button when expanded and customized", () => {
    const onSetEnabled = vi.fn();
    const onRemove = vi.fn();
    render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="disabled"
        isExpanded={true}
        onSetEnabled={onSetEnabled}
        onRemoveCustomization={onRemove}
        onToggleExpand={vi.fn()}
        onJumpToGeneral={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Enabled" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Disabled" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Enabled" }));
    expect(onSetEnabled).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText(/Reset to default/));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("flips aria-pressed when status switches Disabled → Enabled", () => {
    const onSetEnabled = vi.fn();
    const { rerender } = render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="disabled"
        isExpanded={true}
        onSetEnabled={onSetEnabled}
        onRemoveCustomization={() => {}}
        onToggleExpand={vi.fn()}
        onJumpToGeneral={vi.fn()}
      />
    );
    rerender(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="enabled"
        isExpanded={true}
        onSetEnabled={onSetEnabled}
        onRemoveCustomization={() => {}}
        onToggleExpand={vi.fn()}
        onJumpToGeneral={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Enabled" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Disabled" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    fireEvent.click(screen.getByRole("button", { name: "Disabled" }));
    expect(onSetEnabled).toHaveBeenCalledWith(false);
  });

  it("renders a 'custom' badge when any covered entry has _is_custom", () => {
    render(
      <InstrumentationRow
        module={moduleFixture("jmx_metrics", [entry("jmx-metrics", { _is_custom: true })], true)}
        status="none"
        onSetEnabled={() => {}}
        onRemoveCustomization={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.getByText("custom")).toBeInTheDocument();
  });

  it("does not render a 'custom' badge when no covered entry is custom", () => {
    render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="none"
        onSetEnabled={() => {}}
        onRemoveCustomization={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.queryByText("custom")).toBeNull();
  });

  it("renders the configuration options count badge when options are present", () => {
    const cassandraModule = moduleFixture("cassandra", [
      entry("cassandra-4.4", {
        configurations: [
          {
            name: "enabled",
            declarative_name: "otel.instrumentation.cassandra.enabled",
            type: "boolean",
            description: "Enable cassandra",
            default: true,
          },
          {
            name: "some-option",
            declarative_name: "otel.instrumentation.cassandra.some-option",
            type: "string",
            description: "Some option",
            default: "",
          },
        ],
      }),
    ]);
    render(
      <InstrumentationRow
        module={cassandraModule}
        status="none"
        onSetEnabled={() => {}}
        onRemoveCustomization={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.getByText("2 options")).toBeInTheDocument();
  });
});

describe("InstrumentationRow — expansion", () => {
  const baseModule = {
    name: "cassandra",
    defaultDisabled: false,
    coveredEntries: [
      {
        name: "cassandra-4.4",
        scope: { name: "io.opentelemetry.cassandra-4.4" },
        has_spans: false,
        has_metrics: false,
        _is_custom: false,
      },
    ],
  };

  it("renders the config form only when expanded", () => {
    const props = {
      module: baseModule,
      status: "none" as const,
      onSetEnabled: vi.fn(),
      onRemoveCustomization: vi.fn(),
      onToggleExpand: vi.fn(),
      onJumpToGeneral: vi.fn(),
    };
    const { rerender } = render(<InstrumentationRow {...props} isExpanded={false} />);
    expect(screen.queryByTestId("form-stub-cassandra")).toBeNull();
    rerender(<InstrumentationRow {...props} isExpanded={true} />);
    expect(screen.getByTestId("form-stub-cassandra")).toBeInTheDocument();
  });

  it("exposes data-expanded and rotates the chevron icon when expanded", () => {
    const { rerender } = render(
      <InstrumentationRow
        module={baseModule}
        status="none"
        isExpanded={false}
        onSetEnabled={vi.fn()}
        onRemoveCustomization={vi.fn()}
        onToggleExpand={vi.fn()}
        onJumpToGeneral={vi.fn()}
      />
    );
    const row = screen.getByTestId("instrumentation-row-cassandra");
    expect(row.getAttribute("data-expanded")).toBe("false");
    expect(row.querySelector(".rotate-90")).toBeNull();

    rerender(
      <InstrumentationRow
        module={baseModule}
        status="none"
        isExpanded={true}
        onSetEnabled={vi.fn()}
        onRemoveCustomization={vi.fn()}
        onToggleExpand={vi.fn()}
        onJumpToGeneral={vi.fn()}
      />
    );
    expect(row.getAttribute("data-expanded")).toBe("true");
    expect(row.querySelector(".rotate-90")).not.toBeNull();
  });
});
