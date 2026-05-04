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
    default: partial.default ?? "",
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
    expect(screen.getByRole("button", { name: /override/i })).toBeInTheDocument();
  });

  it("clicking Override writes the parsed default at the path", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      declarative_name: "java.graphql.capture_query",
      type: "boolean",
      default: true,
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /override/i }));
    expect(setValueByPath).toHaveBeenCalledWith(
      ["instrumentation/development", "java", "graphql", "capture_query"],
      true
    );
  });

  it("toggles via SwitchPill when overridden", async () => {
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

  it("Override parses CSV (with whitespace) into a real array, not a forwarded string", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      declarative_name: "java.common.http.known_methods",
      type: "list",
      default: " GET , POST ",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /override/i }));
    const [, value] = setValueByPath.mock.calls[0];
    expect(Array.isArray(value)).toBe(true);
    expect(value).toEqual(["GET", "POST"]);
  });

  it("Override seeds with [] for an empty CSV default", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      declarative_name: "general.http.client.request_captured_headers",
      type: "list",
      default: "",
    });
    render(
      <InstrumentationConfigField config={{ ...cfg, scope: "common" }} onJumpToGeneral={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /override/i }));
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

  it("string Override seeds with the default string", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      declarative_name: "java.executors.include",
      type: "string",
      default: "io.foo.*",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /override/i }));
    expect(setValueByPath).toHaveBeenCalledWith(
      ["instrumentation/development", "java", "executors", "include"],
      "io.foo.*"
    );
  });

  it("int Override seeds with the numeric default", async () => {
    const user = userEvent.setup();
    const cfg = makeAggregated({
      declarative_name: "java.example.max_queue",
      type: "int",
      default: 100,
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /override/i }));
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

  it("does not render Override / Reset, renders a jump link instead", async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();
    const cfg = makeAggregated({
      declarative_name: "general.http.server.request_captured_headers",
      type: "list",
      default: "",
    });
    render(<InstrumentationConfigField config={cfg} onJumpToGeneral={onJump} />);
    expect(screen.queryByRole("button", { name: /override/i })).toBeNull();
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
    await user.click(screen.getByRole("button", { name: /override/i }));
    rerender(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /add entry/i }));
    rerender(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /add entry/i }));
    rerender(<InstrumentationConfigField config={cfg} onJumpToGeneral={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /remove entry/i })).toHaveLength(2);
    void stored;
  });
});
