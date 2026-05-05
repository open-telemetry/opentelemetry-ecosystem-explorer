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
import { SchemaRenderer } from "./schema-renderer";
import { StarterPathsContext } from "./configuration-ui-context";

vi.mock("./controls/text-input-control", () => ({
  TextInputControl: ({ node }: { node: { key: string } }) => <span>text:{node.key}</span>,
}));

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: {
      values: {},
      enabledSections: {},
      validationErrors: {},
      version: "1.0.0",
      isDirty: false,
    },
    setValue: vi.fn(),
  }),
}));

describe("SchemaRenderer", () => {
  it("at depth 0 dispatches a leaf to its control component without a wrapper", () => {
    render(
      <SchemaRenderer
        node={{
          controlType: "text_input",
          key: "endpoint",
          label: "Endpoint",
          path: "endpoint",
        }}
        depth={0}
        path="endpoint"
      />
    );
    expect(screen.getByText("text:endpoint")).toBeInTheDocument();
  });

  it("at depth >= 1 wraps a leaf in a chevron row that hides the control until expanded", () => {
    render(
      <SchemaRenderer
        node={{
          controlType: "text_input",
          key: "endpoint",
          label: "Endpoint",
          path: "endpoint",
        }}
        depth={1}
        path="endpoint"
      />
    );
    expect(screen.queryByText("text:endpoint")).not.toBeInTheDocument();
    expect(screen.getByText("Endpoint")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Expand Endpoint/ }));
    expect(screen.getByText("text:endpoint")).toBeInTheDocument();
  });

  it("pre-expands a leaf when its path is in StarterPathsContext", () => {
    render(
      <StarterPathsContext.Provider value={new Set(["endpoint"])}>
        <SchemaRenderer
          node={{
            controlType: "text_input",
            key: "endpoint",
            label: "Endpoint",
            path: "endpoint",
          }}
          depth={1}
          path="endpoint"
        />
      </StarterPathsContext.Provider>
    );
    expect(screen.getByText("text:endpoint")).toBeInTheDocument();
  });
});
