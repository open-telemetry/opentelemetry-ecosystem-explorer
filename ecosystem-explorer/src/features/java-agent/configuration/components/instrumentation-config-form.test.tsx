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
import { render, screen } from "@testing-library/react";
import type { InstrumentationModule } from "@/types/javaagent";
import type { ConfigurationBuilderState } from "@/types/configuration-builder";

const mockState: ConfigurationBuilderState = {
  version: "1.0.0",
  values: {},
  enabledSections: {},
  validationErrors: {},
  isDirty: false,
};

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: mockState,
    setValueByPath: vi.fn(),
    removeMapEntry: vi.fn(),
  }),
}));

import { InstrumentationConfigForm } from "./instrumentation-config-form";

function makeModule(
  coveredEntries: InstrumentationModule["coveredEntries"]
): InstrumentationModule {
  return { name: "graphql_java", defaultDisabled: false, coveredEntries };
}

describe("InstrumentationConfigForm", () => {
  it("renders the empty-state copy when the module has no configurations array at all", () => {
    const mod = makeModule([
      { name: "graphql-java-20.0", scope: { name: "io.opentelemetry.graphql-java-20.0" } },
    ]);
    render(<InstrumentationConfigForm module={mod} onJumpToGeneral={vi.fn()} />);
    expect(screen.getByText(/no configurable options/i)).toBeInTheDocument();
  });

  it("renders the empty-state copy when every config is env-var-only (no declarative_name)", () => {
    const mod = makeModule([
      {
        name: "x-1",
        scope: { name: "io.opentelemetry.x-1" },
        configurations: [
          { name: "otel.env.only", description: "", type: "boolean", default: false },
        ],
      },
    ]);
    render(<InstrumentationConfigForm module={mod} onJumpToGeneral={vi.fn()} />);
    expect(screen.getByText(/no configurable options/i)).toBeInTheDocument();
  });

  it("renders one field per aggregated config in scope order", () => {
    const mod = makeModule([
      {
        name: "graphql-java-20.0",
        scope: { name: "io.opentelemetry.graphql-java-20.0" },
        configurations: [
          {
            name: "owned-1",
            declarative_name: "java.graphql.capture_query",
            description: "owned",
            type: "boolean",
            default: true,
          },
          {
            name: "general-1",
            declarative_name: "general.http.server.request_captured_headers",
            description: "general",
            type: "list",
            default: "",
          },
          {
            name: "common-1",
            declarative_name: "java.common.http.known_methods",
            description: "common",
            type: "list",
            default: "",
          },
        ],
      },
    ]);
    render(<InstrumentationConfigForm module={mod} onJumpToGeneral={vi.fn()} />);
    const fields = screen.getAllByTestId(/^config-field-/);
    expect(fields.map((el) => el.getAttribute("data-scope"))).toEqual([
      "general",
      "common",
      "owned",
    ]);
  });

  it("threads onJumpToGeneral down to fields", () => {
    const onJump = vi.fn();
    const mod = makeModule([
      {
        name: "graphql-java-20.0",
        scope: { name: "io.opentelemetry.graphql-java-20.0" },
        configurations: [
          {
            name: "general-1",
            declarative_name: "general.http.server.request_captured_headers",
            description: "general",
            type: "list",
            default: "",
          },
        ],
      },
    ]);
    render(<InstrumentationConfigForm module={mod} onJumpToGeneral={onJump} />);
    const jumpBtn = screen.getByRole("button", { name: /edit in general settings/i });
    jumpBtn.click();
    expect(onJump).toHaveBeenCalledWith("general");
  });
});
