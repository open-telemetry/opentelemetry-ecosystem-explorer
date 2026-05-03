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
import type { InstrumentationData } from "@/types/javaagent";
import { useInstrumentations } from "@/hooks/use-javaagent-data";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { useOverrideStatusMap } from "@/hooks/use-override-status";
import { InstrumentationBrowser } from "./instrumentation-browser";

vi.mock("@/hooks/use-javaagent-data");
vi.mock("@/hooks/use-configuration-builder");
vi.mock("@/hooks/use-override-status");

const mockedInstr = vi.mocked(useInstrumentations);
const mockedBuilder = vi.mocked(useConfigurationBuilder);
const mockedOverride = vi.mocked(useOverrideStatusMap);

function entry(name: string, opts: Partial<InstrumentationData> = {}): InstrumentationData {
  return {
    name,
    scope: { name: `io.opentelemetry.${name}` },
    ...opts,
  } as InstrumentationData;
}

const FIXTURE: InstrumentationData[] = [
  entry("cassandra-3.0", { description: "Cassandra Driver context propagation" }),
  entry("cassandra-4.0"),
  entry("cassandra-4.4"),
  entry("kafka-clients-0.11", { display_name: "Kafka Clients" }),
  entry("kafka-clients-3.5"),
  entry("jmx-metrics", { disabled_by_default: true }),
];

const setOverride = vi.fn();

beforeEach(() => {
  setOverride.mockReset();
  mockedInstr.mockReturnValue({ data: FIXTURE, loading: false, error: null });
  mockedBuilder.mockReturnValue({
    state: {
      values: {},
      enabledSections: {},
      validationErrors: {},
      isDirty: false,
      version: "2.27.0",
      listItemIds: {},
    },
    setOverride,
  } as unknown as ReturnType<typeof useConfigurationBuilder>);
  mockedOverride.mockReturnValue(new Map());
});

describe("InstrumentationBrowser", () => {
  it("groups entries into module rows with version count", () => {
    render(<InstrumentationBrowser version="2.27.0" search="" statusFilter="all" />);
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.getByText("kafka_clients")).toBeInTheDocument();
    expect(screen.getByText("jmx_metrics")).toBeInTheDocument();
    expect(screen.getByText(/3 versions/)).toBeInTheDocument();
    expect(screen.getByText(/2 versions/)).toBeInTheDocument();
  });

  it("matches search against the registry name of any covered entry", () => {
    render(<InstrumentationBrowser version="2.27.0" search="cassandra-4.4" statusFilter="all" />);
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.queryByText("kafka_clients")).not.toBeInTheDocument();
  });

  it("matches search against display_name on any covered entry", () => {
    render(<InstrumentationBrowser version="2.27.0" search="Kafka Clients" statusFilter="all" />);
    expect(screen.getByText("kafka_clients")).toBeInTheDocument();
    expect(screen.queryByText("cassandra")).not.toBeInTheDocument();
  });

  it("matches search against description on any covered entry", () => {
    render(
      <InstrumentationBrowser version="2.27.0" search="context propagation" statusFilter="all" />
    );
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.queryByText("kafka_clients")).not.toBeInTheDocument();
  });

  it("search is case-insensitive", () => {
    render(<InstrumentationBrowser version="2.27.0" search="CASSANDRA" statusFilter="all" />);
    expect(screen.getByText("cassandra")).toBeInTheDocument();
  });

  it("filters to overridden when statusFilter='overridden'", () => {
    mockedOverride.mockReturnValue(new Map([["cassandra", "disabled"]]));
    render(<InstrumentationBrowser version="2.27.0" search="" statusFilter="overridden" />);
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.queryByText("kafka_clients")).not.toBeInTheDocument();
  });

  it("calls setOverride('cassandra', 'disabled') when + Override is clicked on a default-enabled module", () => {
    render(<InstrumentationBrowser version="2.27.0" search="" statusFilter="all" />);
    fireEvent.click(screen.getByLabelText("Override cassandra"));
    expect(setOverride).toHaveBeenCalledWith("cassandra", "disabled");
  });

  it("calls setOverride('jmx_metrics', 'enabled') when + Override is clicked on a default-disabled module", () => {
    render(<InstrumentationBrowser version="2.27.0" search="" statusFilter="all" />);
    fireEvent.click(screen.getByLabelText("Override jmx_metrics"));
    expect(setOverride).toHaveBeenCalledWith("jmx_metrics", "enabled");
  });

  it("calls setOverride(name, 'none') when ✕ is clicked on an overridden row", () => {
    mockedOverride.mockReturnValue(new Map([["cassandra", "disabled"]]));
    render(<InstrumentationBrowser version="2.27.0" search="" statusFilter="all" />);
    fireEvent.click(screen.getByLabelText("Remove override for cassandra"));
    expect(setOverride).toHaveBeenCalledWith("cassandra", "none");
  });

  it("calls setOverride('cassandra', 'enabled') when toggling overridden Disabled→Enabled", () => {
    mockedOverride.mockReturnValue(new Map([["cassandra", "disabled"]]));
    render(<InstrumentationBrowser version="2.27.0" search="" statusFilter="all" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Enabled" })[0]);
    expect(setOverride).toHaveBeenCalledWith("cassandra", "enabled");
  });

  it("renders empty state for unmatched search", () => {
    render(<InstrumentationBrowser version="2.27.0" search="nonexistent" statusFilter="all" />);
    expect(screen.getByText(/No instrumentations match/)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockedInstr.mockReturnValue({ data: null, loading: true, error: null });
    render(<InstrumentationBrowser version="2.27.0" search="" statusFilter="all" />);
    expect(screen.getByText(/Loading instrumentations/)).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockedInstr.mockReturnValue({ data: null, loading: false, error: new Error("boom") });
    render(<InstrumentationBrowser version="2.27.0" search="" statusFilter="all" />);
    expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
  });
});
