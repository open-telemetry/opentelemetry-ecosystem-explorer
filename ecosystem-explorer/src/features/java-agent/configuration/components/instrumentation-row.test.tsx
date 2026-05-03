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
import type { InstrumentationData, InstrumentationModule } from "@/types/javaagent";
import { InstrumentationRow } from "./instrumentation-row";

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

describe("InstrumentationRow", () => {
  it("renders the module name as the primary label", () => {
    render(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-3.0"), entry("cassandra-4.4")])}
        status="none"
        onAddOverride={() => {}}
        onSetEnabled={() => {}}
        onRemoveOverride={() => {}}
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
      />
    );
    rerender(
      <InstrumentationRow
        module={moduleFixture("cassandra", [entry("cassandra-4.4")])}
        status="enabled"
        onAddOverride={() => {}}
        onSetEnabled={onSetEnabled}
        onRemoveOverride={() => {}}
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
      />
    );
    expect(screen.queryByText("custom")).toBeNull();
  });
});
