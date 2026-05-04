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
import userEvent from "@testing-library/user-event";
import type { InstrumentationData } from "@/types/javaagent";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { useOverrideStatusMap } from "@/hooks/use-override-status";
import { useOverriddenModules } from "@/hooks/use-overridden-modules";
import { InstrumentationBrowser } from "./instrumentation-browser";

vi.mock("@/hooks/use-configuration-builder");
vi.mock("@/hooks/use-override-status");
vi.mock("@/hooks/use-overridden-modules", () => ({
  useOverriddenModules: vi.fn(() => new Set<string>()),
}));

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

const browserDefaults = {
  loading: false,
  error: null,
  onJumpToGeneral: vi.fn(),
} as const;

beforeEach(() => {
  setOverride.mockReset();
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
  vi.mocked(useOverriddenModules).mockReturnValue(new Set<string>());
});

describe("InstrumentationBrowser", () => {
  it("groups entries into module rows with version count", () => {
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.getByText("kafka_clients")).toBeInTheDocument();
    expect(screen.getByText("jmx_metrics")).toBeInTheDocument();
    expect(screen.getByText(/3 versions/)).toBeInTheDocument();
    expect(screen.getByText(/2 versions/)).toBeInTheDocument();
  });

  it("matches search against the registry name of any covered entry", () => {
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search="cassandra-4.4"
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.queryByText("kafka_clients")).not.toBeInTheDocument();
  });

  it("matches search against display_name on any covered entry", () => {
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search="Kafka Clients"
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByText("kafka_clients")).toBeInTheDocument();
    expect(screen.queryByText("cassandra")).not.toBeInTheDocument();
  });

  it("matches search against description on any covered entry", () => {
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search="context propagation"
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.queryByText("kafka_clients")).not.toBeInTheDocument();
  });

  it("search is case-insensitive", () => {
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search="CASSANDRA"
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByText("cassandra")).toBeInTheDocument();
  });

  it("filters to overridden when statusFilter='overridden'", () => {
    vi.mocked(useOverriddenModules).mockReturnValue(new Set(["cassandra"]));
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search=""
        statusFilter="overridden"
        {...browserDefaults}
      />
    );
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.queryByText("kafka_clients")).not.toBeInTheDocument();
  });

  it("calls setOverride('cassandra', 'disabled') when + Override is clicked on a default-enabled module", () => {
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    fireEvent.click(screen.getByLabelText("Override cassandra"));
    expect(setOverride).toHaveBeenCalledWith("cassandra", "disabled");
  });

  it("calls setOverride('jmx_metrics', 'enabled') when + Override is clicked on a default-disabled module", () => {
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    fireEvent.click(screen.getByLabelText("Override jmx_metrics"));
    expect(setOverride).toHaveBeenCalledWith("jmx_metrics", "enabled");
  });

  it("calls setOverride(name, 'none') when ✕ is clicked on an overridden row", () => {
    mockedOverride.mockReturnValue(new Map([["cassandra", "disabled"]]));
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    fireEvent.click(screen.getByLabelText("Remove override for cassandra"));
    expect(setOverride).toHaveBeenCalledWith("cassandra", "none");
  });

  it("calls setOverride('cassandra', 'enabled') when toggling overridden Disabled→Enabled", () => {
    mockedOverride.mockReturnValue(new Map([["cassandra", "disabled"]]));
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Enabled" })[0]);
    expect(setOverride).toHaveBeenCalledWith("cassandra", "enabled");
  });

  it("renders empty state for unmatched search", () => {
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search="nonexistent"
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByText(/No instrumentations match/)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <InstrumentationBrowser
        instrumentations={null}
        loading={true}
        error={null}
        search=""
        statusFilter="all"
        onJumpToGeneral={vi.fn()}
      />
    );
    expect(screen.getByText(/Loading instrumentations/)).toBeInTheDocument();
  });

  it("shows error state", () => {
    render(
      <InstrumentationBrowser
        instrumentations={null}
        loading={false}
        error={new Error("boom")}
        search=""
        statusFilter="all"
        onJumpToGeneral={vi.fn()}
      />
    );
    expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
  });
});

describe("InstrumentationBrowser — expansion and override filter", () => {
  beforeEach(() => {
    vi.mocked(useOverriddenModules).mockReturnValue(new Set<string>());
  });

  const cassandraData = [
    {
      name: "cassandra-4.4",
      scope: { name: "io.opentelemetry.cassandra-4.4" },
      configurations: [
        {
          name: "x",
          declarative_name: "java.cassandra.query_sanitization.enabled",
          description: "",
          type: "boolean" as const,
          default: true,
        },
      ],
    },
  ];
  const twoModules = [
    { name: "cassandra-4.4", scope: { name: "io.opentelemetry.cassandra-4.4" } },
    { name: "graphql-java-20.0", scope: { name: "io.opentelemetry.graphql-java-20.0" } },
  ];

  it("expands a row when its toggle button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <InstrumentationBrowser
        instrumentations={cassandraData}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    const row = screen.getByTestId("instrumentation-row-cassandra");
    expect(row.getAttribute("data-expanded")).toBe("false");
    await user.click(screen.getByRole("button", { name: /toggle details for cassandra/i }));
    expect(row.getAttribute("data-expanded")).toBe("true");
  });

  it("keeps multiple rows expanded simultaneously", async () => {
    const user = userEvent.setup();
    render(
      <InstrumentationBrowser
        instrumentations={twoModules}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    const cass = screen.getByTestId("instrumentation-row-cassandra");
    const graphql = screen.getByTestId("instrumentation-row-graphql_java");
    expect(cass.getAttribute("data-expanded")).toBe("false");
    expect(graphql.getAttribute("data-expanded")).toBe("false");
    await user.click(screen.getByRole("button", { name: /toggle details for cassandra/i }));
    await user.click(screen.getByRole("button", { name: /toggle details for graphql_java/i }));
    expect(cass.getAttribute("data-expanded")).toBe("true");
    expect(graphql.getAttribute("data-expanded")).toBe("true");
  });

  it("uses useOverriddenModules to filter when statusFilter is 'overridden'", () => {
    vi.mocked(useOverriddenModules).mockReturnValue(new Set(["cassandra"]));
    render(
      <InstrumentationBrowser
        instrumentations={twoModules}
        search=""
        statusFilter="overridden"
        {...browserDefaults}
      />
    );
    expect(screen.getByTestId("instrumentation-row-cassandra")).toBeInTheDocument();
    expect(screen.queryByTestId("instrumentation-row-graphql_java")).toBeNull();
  });

  it("renders the override count in the header from useOverriddenModules", () => {
    vi.mocked(useOverriddenModules).mockReturnValue(new Set(["cassandra"]));
    render(
      <InstrumentationBrowser
        instrumentations={[twoModules[0]]}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByText(/1 overridden/i)).toBeInTheDocument();
  });
});
