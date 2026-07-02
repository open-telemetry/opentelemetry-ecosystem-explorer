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
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InstrumentationListEntry } from "@/types/javaagent";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { useCustomizationStatusMap } from "@/hooks/use-customization-status";
import { useCustomizedModules } from "@/hooks/use-customized-modules";
import { InstrumentationBrowser } from "./instrumentation-browser";
import { SectionExpansionProvider } from "./section-expansion-context";

vi.mock("@/hooks/use-configuration-builder");
vi.mock("@/hooks/use-customization-status");
vi.mock("@/hooks/use-customized-modules", () => ({
  useCustomizedModules: vi.fn(() => new Set<string>()),
}));

const mockedBuilder = vi.mocked(useConfigurationBuilder);
const mockedCustomization = vi.mocked(useCustomizationStatusMap);

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

const FIXTURE: InstrumentationListEntry[] = [
  entry("cassandra-3.0", { description: "Cassandra Driver context propagation" }),
  entry("cassandra-4.0"),
  entry("cassandra-4.4"),
  entry("kafka-clients-0.11", { display_name: "Kafka Clients" }),
  entry("kafka-clients-3.5"),
  entry("jmx-metrics", { disabled_by_default: true }),
];

const setCustomization = vi.fn();

const browserDefaults = {
  loading: false,
  error: null,
  onJumpToGeneral: vi.fn(),
} as const;

beforeEach(() => {
  setCustomization.mockReset();
  mockedBuilder.mockReturnValue({
    state: {
      values: {},
      enabledSections: {},
      validationErrors: {},
      isDirty: false,
      version: "2.27.0",
      listItemIds: {},
    },
    setCustomization,
  } as unknown as ReturnType<typeof useConfigurationBuilder>);
  mockedCustomization.mockReturnValue(new Map());
  vi.mocked(useCustomizedModules).mockReturnValue(new Set<string>());
});

function renderWithProvider(ui: React.ReactElement) {
  return render(<SectionExpansionProvider>{ui}</SectionExpansionProvider>);
}

describe("InstrumentationBrowser", () => {
  it("groups entries into module rows with version count", () => {
    renderWithProvider(
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
    renderWithProvider(
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
    renderWithProvider(
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
    renderWithProvider(
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
    renderWithProvider(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search="CASSANDRA"
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByText("cassandra")).toBeInTheDocument();
  });

  it("filters to customized when statusFilter='customized'", () => {
    vi.mocked(useCustomizedModules).mockReturnValue(new Set(["cassandra"]));
    renderWithProvider(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search=""
        statusFilter="customized"
        {...browserDefaults}
      />
    );
    expect(screen.getByText("cassandra")).toBeInTheDocument();
    expect(screen.queryByText("kafka_clients")).not.toBeInTheDocument();
  });

  it("calls setCustomization(name, 'none') when Reset is clicked on a customized row inside expanded panel", async () => {
    mockedCustomization.mockReturnValue(new Map([["cassandra", "disabled"]]));
    const user = userEvent.setup();
    renderWithProvider(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    // Expand the row first
    await user.click(screen.getByText("cassandra"));
    // Then click reset
    await user.click(screen.getByText("Reset to default"));
    expect(setCustomization).toHaveBeenCalledWith("cassandra", "none");
  });

  it("calls setCustomization('cassandra', 'enabled') when toggling customized Disabled→Enabled in expanded panel", async () => {
    mockedCustomization.mockReturnValue(new Map([["cassandra", "disabled"]]));
    const user = userEvent.setup();
    renderWithProvider(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    await user.click(screen.getByText("cassandra"));
    await user.click(screen.getByRole("button", { name: "Enabled" }));
    expect(setCustomization).toHaveBeenCalledWith("cassandra", "enabled");
  });

  it("renders empty state for unmatched search", () => {
    renderWithProvider(
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
    renderWithProvider(
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
    renderWithProvider(
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

describe("InstrumentationBrowser — expansion and customization filter", () => {
  beforeEach(() => {
    vi.mocked(useCustomizedModules).mockReturnValue(new Set<string>());
  });

  const cassandraData = [
    {
      name: "cassandra-4.4",
      scope: { name: "io.opentelemetry.cassandra-4.4" },
      has_spans: false,
      has_metrics: false,
      _is_custom: false,
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
    {
      name: "cassandra-4.4",
      scope: { name: "io.opentelemetry.cassandra-4.4" },
      has_spans: false,
      has_metrics: false,
      _is_custom: false,
    },
    {
      name: "graphql-java-20.0",
      scope: { name: "io.opentelemetry.graphql-java-20.0" },
      has_spans: false,
      has_metrics: false,
      _is_custom: false,
    },
  ];

  it("expands a row when its header is clicked", async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <InstrumentationBrowser
        instrumentations={cassandraData}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    const row = screen.getByTestId("instrumentation-row-cassandra");
    expect(row.getAttribute("data-expanded")).toBe("false");
    await user.click(screen.getByText("cassandra"));
    expect(row.getAttribute("data-expanded")).toBe("true");
  });

  it("keeps multiple rows expanded simultaneously", async () => {
    const user = userEvent.setup();
    renderWithProvider(
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
    await user.click(screen.getByText("cassandra"));
    await user.click(screen.getByText("graphql_java"));
    expect(cass.getAttribute("data-expanded")).toBe("true");
    expect(graphql.getAttribute("data-expanded")).toBe("true");
  });

  it("uses useCustomizedModules to filter when statusFilter is 'customized'", () => {
    vi.mocked(useCustomizedModules).mockReturnValue(new Set(["cassandra"]));
    renderWithProvider(
      <InstrumentationBrowser
        instrumentations={twoModules}
        search=""
        statusFilter="customized"
        {...browserDefaults}
      />
    );
    expect(screen.getByTestId("instrumentation-row-cassandra")).toBeInTheDocument();
    expect(screen.queryByTestId("instrumentation-row-graphql_java")).toBeNull();
  });

  it("renders the customization count in the header from useCustomizedModules", () => {
    vi.mocked(useCustomizedModules).mockReturnValue(new Set(["cassandra"]));
    renderWithProvider(
      <InstrumentationBrowser
        instrumentations={[twoModules[0]]}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByText(/1 customized/i)).toBeInTheDocument();
  });
});

describe("InstrumentationBrowser — Add all configs", () => {
  // Two modules sharing one common config plus one owned config each → 3 deduped
  // config entries total.
  const commonCfg = {
    name: "otel.methods",
    declarative_name: "java.common.http.known_methods",
    description: "",
    type: "list" as const,
    default: "GET,POST",
  };
  const modulesWithConfigs: InstrumentationData[] = [
    {
      name: "cassandra-4.4",
      scope: { name: "io.opentelemetry.cassandra-4.4" },
      configurations: [
        commonCfg,
        {
          name: "x",
          declarative_name: "java.cassandra.query_sanitization.enabled",
          description: "",
          type: "boolean" as const,
          default: true,
        },
      ],
    },
    {
      name: "graphql-java-20.0",
      scope: { name: "io.opentelemetry.graphql-java-20.0" },
      configurations: [
        commonCfg,
        {
          name: "y",
          declarative_name: "java.graphql.capture_query",
          description: "",
          type: "boolean" as const,
          default: false,
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.mocked(useOverriddenModules).mockReturnValue(new Set<string>());
  });

  it("renders an 'Add all configs' button distinct from the SDK 'Add all'", () => {
    render(
      <InstrumentationBrowser
        instrumentations={modulesWithConfigs}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByRole("button", { name: "Add all configs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Add all$/ })).toBeNull();
  });

  it("calls mergeDefaults once with the deduped entry set when confirmed", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <InstrumentationBrowser
        instrumentations={modulesWithConfigs}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Add all configs" }));
    expect(mergeDefaults).toHaveBeenCalledTimes(1);
    expect(mergeDefaults.mock.calls[0][0]).toHaveLength(3);
    confirmSpy.mockRestore();
  });

  it("does not call mergeDefaults when the confirm is cancelled", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <InstrumentationBrowser
        instrumentations={modulesWithConfigs}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Add all configs" }));
    expect(mergeDefaults).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("counts all modules regardless of the active filter", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <InstrumentationBrowser
        instrumentations={modulesWithConfigs}
        search="cassandra"
        statusFilter="all"
        {...browserDefaults}
      />
    );
    // graphql_java is filtered out of the list...
    expect(screen.queryByTestId("instrumentation-row-graphql_java")).toBeNull();
    // ...but Add all still adds the full deduped set (3), not just cassandra's.
    fireEvent.click(screen.getByRole("button", { name: "Add all configs" }));
    expect(mergeDefaults.mock.calls[0][0]).toHaveLength(3);
    confirmSpy.mockRestore();
  });

  it("disables the button when there are no config entries", () => {
    render(
      <InstrumentationBrowser
        instrumentations={FIXTURE}
        search=""
        statusFilter="all"
        {...browserDefaults}
      />
    );
    expect(screen.getByRole("button", { name: "Add all configs" })).toBeDisabled();
  });
});
