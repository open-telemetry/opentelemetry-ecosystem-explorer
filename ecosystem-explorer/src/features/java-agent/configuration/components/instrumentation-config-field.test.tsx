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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Configuration } from "@/types/javaagent";
import type { ConfigurationBuilderState, ConfigValue } from "@/types/configuration-builder";
import type { AggregatedConfig } from "@/lib/configurations-aggregate";

const setValueByPath = vi.fn();
const removeMapEntry = vi.fn();

let mockState: ConfigurationBuilderState;

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: mockState,
    setValueByPath: (...args: unknown[]) => setValueByPath(...args),
    removeMapEntry: (...args: unknown[]) => removeMapEntry(...args),
  }),
}));

import { InstrumentationConfigField } from "./instrumentation-config-field";

const baseState: ConfigurationBuilderState = {
  version: "1.0.0",
  values: {},
  enabledSections: {},
  validationErrors: {},
  isDirty: false,
};

function makeAggregated(
  partial: Partial<Configuration> & { declarative_name: string; type: Configuration["type"] }
): AggregatedConfig {
  const entry: Configuration = {
    name: partial.name ?? "otel.placeholder",
    description: partial.description ?? "Description.",
    type: partial.type,
    ...(partial.default !== undefined ? { default: partial.default } : {}),
    declarative_name: partial.declarative_name,
  };
  const scope = partial.declarative_name.startsWith("general.")
    ? "general"
    : partial.declarative_name.startsWith("java.common.")
      ? "common"
      : "owned";
  return {
    entry,
    scope,
    path: ["instrumentation/development", ...partial.declarative_name.split(".")],
  };
}

describe("InstrumentationConfigField — boolean", () => {
  beforeEach(() => {
    setValueByPath.mockClear();
    removeMapEntry.mockClear();
    mockState = { ...baseState, values: {} };
  });

  it("renders the declarative_name label and description in default state", () => {
    const cfg = makeAggregated({
      declarative_name: "java.graphql.capture_query",
      type: "boolean",
      default: true,
      description: "Whether to capture the query.",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    expect(screen.getByText("java.graphql.capture_query")).toBeInTheDocument();
    expect(screen.getByText(/whether to capture/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /customize/i })).toBeInTheDocument();
  });

  it("clicking Customize writes the parsed default at the path", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      declarative_name: "java.graphql.capture_query",
      type: "boolean",
      default: true,
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /customize/i }));
    expect(setValueByPath).toHaveBeenCalledWith(
      ["instrumentation/development", "java", "graphql", "capture_query"],
      true
    );
  });

  it("toggles via SwitchPill when customized", async () => {
    const user = userEvent.setup();
    mockState = {
      ...baseState,
      values: {
        "instrumentation/development": { java: { graphql: { capture_query: true } } },
      },
    };
    const cfg = makeAggregated({
      declarative_name: "java.graphql.capture_query",
      type: "boolean",
      default: true,
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("switch"));
    expect(setValueByPath).toHaveBeenCalledWith(
      ["instrumentation/development", "java", "graphql", "capture_query"],
      false
    );
  });

  it("Reset removes the leaf via removeMapEntry on the parent path", async () => {
    const user = userEvent.setup();
    mockState = {
      ...baseState,
      values: {
        "instrumentation/development": { java: { graphql: { capture_query: false } } },
      },
    };
    const cfg = makeAggregated({
      declarative_name: "java.graphql.capture_query",
      type: "boolean",
      default: true,
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /reset/i }));
    expect(removeMapEntry).toHaveBeenCalledWith(
      "instrumentation/development.java.graphql",
      "capture_query"
    );
  });
});

describe("InstrumentationConfigField — list", () => {
  beforeEach(() => {
    setValueByPath.mockClear();
    removeMapEntry.mockClear();
    mockState = { ...baseState, values: {} };
  });

  it("Customize parses CSV (with whitespace) into a real array, not a forwarded string", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      declarative_name: "java.common.http.known_methods",
      type: "list",
      default: " GET , POST ",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /customize/i }));
    const [, value] = setValueByPath.mock.calls[0];
    expect(Array.isArray(value)).toBe(true);
    expect(value).toEqual(["GET", "POST"]);
  });

  it("Customize seeds with [] for an empty CSV default", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      declarative_name: "general.http.client.request_captured_headers",
      type: "list",
      default: "",
    });
    render(
      <InstrumentationConfigField config={{ ...cfg, scope: "common" }} onJumpToGeneral={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /customize/i }));
    const [, value] = setValueByPath.mock.calls[0];
    expect(value).toEqual([]);
  });
});

describe("InstrumentationConfigField — string / int / double", () => {
  beforeEach(() => {
    setValueByPath.mockClear();
    removeMapEntry.mockClear();
    mockState = { ...baseState, values: {} };
  });

  it("string Customize seeds with the default string", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      declarative_name: "java.executors.include",
      type: "string",
      default: "io.foo.*",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /customize/i }));
    expect(setValueByPath).toHaveBeenCalledWith(
      ["instrumentation/development", "java", "executors", "include"],
      "io.foo.*"
    );
  });

  it("int Customize seeds with the numeric default", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      declarative_name: "java.example.max_queue",
      type: "int",
      default: 100,
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /customize/i }));
    expect(setValueByPath).toHaveBeenCalledWith(
      ["instrumentation/development", "java", "example", "max_queue"],
      100
    );
  });
});

describe("InstrumentationConfigField — read-only general scope", () => {
  beforeEach(() => {
    setValueByPath.mockClear();
    removeMapEntry.mockClear();
    mockState = { ...baseState, values: {} };
  });

  it("does not render Customize / Reset, renders a jump link instead", async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();
    const cfg = makeAggregated({
      declarative_name: "general.http.server.request_captured_headers",
      type: "list",
      default: "",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={onJump} />);
    expect(screen.queryByRole("button", { name: /customize/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /edit in general settings/i }));
    expect(onJump).toHaveBeenCalledWith("general");
  });
});

describe("InstrumentationConfigField — pills", () => {
  beforeEach(() => {
    setValueByPath.mockClear();
    removeMapEntry.mockClear();
    mockState = { ...baseState, values: {} };
  });

  it("renders the java.common shared pill for common scope", () => {
    const cfg = makeAggregated({
      declarative_name: "java.common.http.known_methods",
      type: "list",
      default: "",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    expect(screen.getByText(/java\.common · shared/i)).toBeInTheDocument();
  });

  it("renders the experimental pill when /development appears in the path", () => {
    const cfg = makeAggregated({
      declarative_name: "java.aws_sdk.experimental_span_attributes/development",
      type: "boolean",
      default: false,
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    expect(screen.getByText("experimental")).toBeInTheDocument();
  });

  it("does NOT render the experimental pill for stable paths (negative case)", () => {
    const cfg = makeAggregated({
      declarative_name: "java.graphql.capture_query",
      type: "boolean",
      default: true,
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    expect(screen.queryByText(/experimental/i)).toBeNull();
  });
});

describe("InstrumentationConfigField — imported value type mismatch", () => {
  beforeEach(() => {
    setValueByPath.mockClear();
    removeMapEntry.mockClear();
    mockState = { ...baseState, values: {} };
  });

  it("renders a mismatch pill when the loaded value's runtime type does not match the registry type", () => {
    mockState = {
      ...baseState,
      values: {
        "instrumentation/development": {
          java: { common: { http: { known_methods: "not-a-list" } } },
        },
      },
    };
    const cfg = makeAggregated({
      declarative_name: "java.common.http.known_methods",
      type: "list",
      default: "GET",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    expect(screen.getByText(/imported value not a list/i)).toBeInTheDocument();
  });

  it("does NOT render the mismatch pill when types match", () => {
    mockState = {
      ...baseState,
      values: {
        "instrumentation/development": {
          java: { common: { http: { known_methods: ["GET"] } } },
        },
      },
    };
    const cfg = makeAggregated({
      declarative_name: "java.common.http.known_methods",
      type: "list",
      default: "GET",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    expect(screen.queryByText(/imported value/i)).toBeNull();
  });
});

describe("InstrumentationConfigField — number blank → reset", () => {
  beforeEach(() => {
    setValueByPath.mockClear();
    removeMapEntry.mockClear();
    mockState = { ...baseState, values: {} };
  });

  it("clearing a number input calls removeMapEntry, not setValueByPath(null)", async () => {
    const user = userEvent.setup();
    mockState = {
      ...baseState,
      values: {
        "instrumentation/development": { java: { example: { max_queue: 50 } } },
      },
    };
    const cfg = makeAggregated({
      declarative_name: "java.example.max_queue",
      type: "int",
      default: 100,
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    expect(removeMapEntry).toHaveBeenCalledWith(
      "instrumentation/development.java.example",
      "max_queue"
    );
    expect(setValueByPath).not.toHaveBeenCalledWith(expect.anything(), null);
  });
});

describe("InstrumentationConfigField — map entries grow", () => {
  beforeEach(() => {
    setValueByPath.mockClear();
    removeMapEntry.mockClear();
    mockState = { ...baseState, values: {} };
  });

  it("clicking 'Add entry' twice produces two entries (no key collapse)", async () => {
    const user = userEvent.setup();
    let stored: unknown = undefined;
    setValueByPath.mockImplementation((_p: unknown, v: unknown) => {
      stored = v;
      mockState = {
        ...baseState,
        values: {
          "instrumentation/development": {
            java: { common: { peer_service_mapping: v as ConfigValue } },
          },
        },
      };
    });
    const cfg = makeAggregated({
      declarative_name: "java.common.peer_service_mapping",
      type: "map",
      default: "",
    });
    const { rerender } = render(
      <InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /customize/i }));
    rerender(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    rerender(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    rerender(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /remove entry/i })).toHaveLength(2);
    void stored;
  });
});

describe("InstrumentationConfigField — config without a default", () => {
  const jdbcQuerySanitization = makeAggregated({
    name: "otel.instrumentation.jdbc.query-sanitization.enabled",
    declarative_name: "java.jdbc.query_sanitization.enabled",
    description:
      "Overrides the common setting for this instrumentation; when unset, that setting applies.",
    type: "boolean",
  });
  const dbSemconvVersion = makeAggregated({
    declarative_name: "general.db.semconv.version",
    description: "Database semantic convention version to emit.",
    type: "int",
  });

  beforeEach(() => {
    setValueByPath.mockClear();
    removeMapEntry.mockClear();
    mockState = { ...baseState, values: {} };
  });

  it("does not render a default preview or an empty controls row when the default is absent", () => {
    render(<InstrumentationConfigField config={jdbcQuerySanitization} onJumpToGeneral={vi.fn()} />);
    expect(screen.queryByText(/default:/i)).toBeNull();
    expect(screen.getByText(jdbcQuerySanitization.entry.description).nextElementSibling).toBeNull();
    expect(screen.getByRole("button", { name: /customize/i })).toBeInTheDocument();
  });

  it("renders no control for a read-only config without a default or a value", () => {
    render(<InstrumentationConfigField config={dbSemconvVersion} onJumpToGeneral={vi.fn()} />);
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByText(dbSemconvVersion.entry.description).nextElementSibling).toBeNull();
  });

  it("shows the value set in General for a read-only config without a default", () => {
    mockState = {
      ...baseState,
      values: { "instrumentation/development": { general: { db: { semconv: { version: 1 } } } } },
    };
    render(<InstrumentationConfigField config={dbSemconvVersion} onJumpToGeneral={vi.fn()} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveValue(1);
    expect(input).toBeDisabled();
  });

  it("keeps rendering an empty-string default as (empty)", () => {
    const cfg = makeAggregated({
      declarative_name: "java.executors.include",
      type: "string",
      default: "",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    expect(screen.getByText("default: (empty)")).toBeInTheDocument();
  });

  it("Customize on a boolean opens an unset select without writing a value", async () => {
    const user = userEvent.setup();
    render(<InstrumentationConfigField config={jdbcQuerySanitization} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /customize/i }));
    expect(setValueByPath).not.toHaveBeenCalled();
    expect(screen.queryByRole("switch")).toBeNull();
    const select = screen.getByRole("combobox", { name: "java.jdbc.query_sanitization.enabled" });
    expect(select).toHaveValue("");
    expect(
      Array.from(select.querySelectorAll("option")).map((o) => (o as HTMLOptionElement).value)
    ).toEqual(["", "true", "false"]);
    expect(screen.getByRole("option", { name: "Not set" })).toHaveValue("");
  });

  it("writes the boolean the user picks from the select", async () => {
    const user = userEvent.setup();
    render(<InstrumentationConfigField config={jdbcQuerySanitization} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.selectOptions(screen.getByRole("combobox"), "false");
    expect(setValueByPath).toHaveBeenCalledWith(jdbcQuerySanitization.path, false);
  });

  it("picking the unset option removes the value instead of storing null and keeps the select open", async () => {
    const user = userEvent.setup();
    mockState = {
      ...baseState,
      values: {
        "instrumentation/development": {
          java: { jdbc: { query_sanitization: { enabled: true } } },
        },
      },
    };
    removeMapEntry.mockImplementationOnce(() => {
      mockState = { ...baseState, values: {} };
    });
    const { rerender } = render(
      <InstrumentationConfigField config={jdbcQuerySanitization} onJumpToGeneral={vi.fn()} />
    );
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("true");
    await user.selectOptions(select, "");
    rerender(
      <InstrumentationConfigField config={jdbcQuerySanitization} onJumpToGeneral={vi.fn()} />
    );
    expect(removeMapEntry).toHaveBeenCalledWith(
      "instrumentation/development.java.jdbc.query_sanitization",
      "enabled"
    );
    expect(setValueByPath).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("Reset closes the unset editor and returns to Customize", async () => {
    const user = userEvent.setup();
    render(<InstrumentationConfigField config={jdbcQuerySanitization} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.click(screen.getByRole("button", { name: /reset/i }));
    expect(removeMapEntry).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: /customize/i })).toBeInTheDocument();
  });

  it("collapses back to Customize when a global reset clears the value the user picked", async () => {
    const user = userEvent.setup();
    setValueByPath.mockImplementationOnce((_p: unknown, v: unknown) => {
      mockState = {
        ...baseState,
        values: {
          "instrumentation/development": {
            java: { jdbc: { query_sanitization: { enabled: v as ConfigValue } } },
          },
        },
      };
    });
    const { rerender } = render(
      <InstrumentationConfigField config={jdbcQuerySanitization} onJumpToGeneral={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.selectOptions(screen.getByRole("combobox"), "true");
    rerender(
      <InstrumentationConfigField config={jdbcQuerySanitization} onJumpToGeneral={vi.fn()} />
    );
    expect(screen.getByRole("combobox")).toHaveValue("true");
    mockState = { ...baseState, values: {} };
    rerender(
      <InstrumentationConfigField config={jdbcQuerySanitization} onJumpToGeneral={vi.fn()} />
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: /customize/i })).toBeInTheDocument();
  });

  it("drops the unset editor when a rerender gives the same config a default", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <InstrumentationConfigField config={jdbcQuerySanitization} onJumpToGeneral={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /customize/i }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    const withDefault: AggregatedConfig = {
      ...jdbcQuerySanitization,
      entry: { ...jdbcQuerySanitization.entry, default: true },
    };
    rerender(<InstrumentationConfigField config={withDefault} onJumpToGeneral={vi.fn()} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: /customize/i })).toBeInTheDocument();
    expect(screen.getByText("default: true")).toBeInTheDocument();
    expect(setValueByPath).not.toHaveBeenCalled();
  });

  it("erasing a typed string removes the entry instead of storing an empty string", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      name: "otel.instrumentation.experimental.span-suppression-strategy",
      declarative_name: "java.common.span_suppression_strategy/development",
      type: "string",
    });
    setValueByPath.mockImplementationOnce((_p: unknown, v: unknown) => {
      mockState = {
        ...baseState,
        values: {
          "instrumentation/development": {
            java: { common: { "span_suppression_strategy/development": v as ConfigValue } },
          },
        },
      };
    });
    removeMapEntry.mockImplementationOnce(() => {
      mockState = { ...baseState, values: {} };
    });
    const { rerender } = render(
      <InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.type(screen.getByRole("textbox"), "x");
    rerender(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.clear(screen.getByRole("textbox"));
    rerender(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    expect(setValueByPath).toHaveBeenCalledTimes(1);
    expect(setValueByPath).not.toHaveBeenCalledWith(expect.anything(), "");
    expect(removeMapEntry).toHaveBeenCalledWith(
      "instrumentation/development.java.common",
      "span_suppression_strategy/development"
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("Customize on an int opens an empty input and writes only what the user types", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      name: "otel.instrumentation.example.max-queue",
      declarative_name: "java.example.max_queue",
      type: "int",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /customize/i }));
    expect(setValueByPath).not.toHaveBeenCalled();
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveValue(null);
    await user.type(input, "7");
    expect(setValueByPath).toHaveBeenCalledWith(
      ["instrumentation/development", "java", "example", "max_queue"],
      7
    );
  });

  it("Customize on a list opens an empty editor and writes only the items the user adds", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      name: "otel.semconv-stability.preview",
      declarative_name: "java.common.semconv_stability.preview",
      type: "list",
    });
    setValueByPath.mockImplementationOnce((_p: unknown, v: unknown) => {
      mockState = {
        ...baseState,
        values: {
          "instrumentation/development": {
            java: { common: { semconv_stability: { preview: v as ConfigValue } } },
          },
        },
      };
    });
    const { rerender } = render(
      <InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /customize/i }));
    expect(setValueByPath).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(setValueByPath).toHaveBeenLastCalledWith(cfg.path, [""]);
    rerender(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.type(screen.getByRole("textbox"), "x");
    expect(setValueByPath).toHaveBeenLastCalledWith(cfg.path, ["x"]);
  });
});
