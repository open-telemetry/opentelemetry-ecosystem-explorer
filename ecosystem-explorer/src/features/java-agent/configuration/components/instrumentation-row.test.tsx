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
import userEvent from "@testing-library/user-event";
import type { InstrumentationData, InstrumentationModule } from "@/types/javaagent";
import { InstrumentationRow } from "./instrumentation-row";

vi.mock("./instrumentation-config-form", () => ({
  InstrumentationConfigForm: ({ module: m }: { module: { name: string } }) => (
    <div data-testid={`form-stub-${m.name}`} />
  ),
}));

function entry(name: string, opts: Partial<InstrumentationData> = {}): InstrumentationData {
  return {
    name,
    scope: { name: `io.opentelemetry.${name}` },
    ...opts,
  } as InstrumentationData;
}

function moduleFixture(
  name: string,
  coveredEntries: InstrumentationData[],
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
        onAddOverride={() => {}}
        onSetEnabled={() => {}}
        onRemoveOverride={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.getByText(/2 versions/)).toBeInTheDocument();
  });

  it("shows 'enabled by default' pill for default-enabled modules", () => {
    render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="none"
        onAddOverride={() => {}}
        onSetEnabled={() => {}}
        onRemoveOverride={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.getByText("enabled by default")).toBeInTheDocument();
  });

  it("shows 'disabled by default' pill for default-disabled modules", () => {
    render(
      <InstrumentationRow
        module={moduleFixture("jmx_metrics", [entry("jmx-metrics")], true)}
        status="none"
        onAddOverride={() => {}}
        onSetEnabled={() => {}}
        onRemoveOverride={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.getByText("disabled by default")).toBeInTheDocument();
  });

  it("calls onAddOverride when + Override is clicked", () => {
    const onAdd = vi.fn();
    render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="none"
        onAddOverride={onAdd}
        onSetEnabled={() => {}}
        onRemoveOverride={() => {}}
        {...expansionDefaults}
      />
    );
    fireEvent.click(screen.getByLabelText(/Override cassandra/));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("renders the toggle and ✕ when overridden, with correct aria-pressed", () => {
    const onSetEnabled = vi.fn();
    const onRemove = vi.fn();
    render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="disabled"
        onAddOverride={() => {}}
        onSetEnabled={onSetEnabled}
        onRemoveOverride={onRemove}
        {...expansionDefaults}
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
    fireEvent.click(screen.getByLabelText(/Remove override for cassandra/));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("flips aria-pressed when status switches Disabled → Enabled", () => {
    const onSetEnabled = vi.fn();
    const { rerender } = render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="disabled"
        onAddOverride={() => {}}
        onSetEnabled={onSetEnabled}
        onRemoveOverride={() => {}}
        {...expansionDefaults}
      />
    );
    rerender(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="enabled"
        onAddOverride={() => {}}
        onSetEnabled={onSetEnabled}
        onRemoveOverride={() => {}}
        {...expansionDefaults}
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
        onAddOverride={() => {}}
        onSetEnabled={() => {}}
        onRemoveOverride={() => {}}
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
        onAddOverride={() => {}}
        onSetEnabled={() => {}}
        onRemoveOverride={() => {}}
        {...expansionDefaults}
      />
    );
    expect(screen.queryByText("custom")).toBeNull();
  });
});

describe("InstrumentationRow — expansion", () => {
  const baseModule = {
    name: "cassandra",
    defaultDisabled: false,
    coveredEntries: [{ name: "cassandra-4.4", scope: { name: "io.opentelemetry.cassandra-4.4" } }],
  };

  it("calls onToggleExpand when the toggle button is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <InstrumentationRow
        module={baseModule}
        status="none"
        isExpanded={false}
        onAddOverride={vi.fn()}
        onSetEnabled={vi.fn()}
        onRemoveOverride={vi.fn()}
        onToggleExpand={onToggle}
        onJumpToGeneral={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /toggle details for cassandra/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders the config form only when expanded", () => {
    const props = {
      module: baseModule,
      status: "none" as const,
      onAddOverride: vi.fn(),
      onSetEnabled: vi.fn(),
      onRemoveOverride: vi.fn(),
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
        onAddOverride={vi.fn()}
        onSetEnabled={vi.fn()}
        onRemoveOverride={vi.fn()}
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
        onAddOverride={vi.fn()}
        onSetEnabled={vi.fn()}
        onRemoveOverride={vi.fn()}
        onToggleExpand={vi.fn()}
        onJumpToGeneral={vi.fn()}
      />
    );
    expect(row.getAttribute("data-expanded")).toBe("true");
    expect(row.querySelector(".rotate-90")).not.toBeNull();
  });
});
