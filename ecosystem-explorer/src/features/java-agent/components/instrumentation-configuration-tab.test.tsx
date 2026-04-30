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
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Configuration } from "@/types/javaagent";
import { InstrumentationConfigurationTab } from "./instrumentation-configuration-tab";

const baseConfig: Configuration = {
  name: "otel.instrumentation.http.known-methods",
  declarative_name: "java.common.http.known_methods",
  description: "Known HTTP methods.",
  type: "list",
  default: "GET,POST",
};

const stableDevConfig: Configuration = {
  name: "otel.instrumentation.http.emit-experimental-telemetry",
  declarative_name: "java.common.http.client.emit_experimental_telemetry/development",
  description: "Emit experimental HTTP client telemetry.",
  type: "boolean",
  default: false,
};

const emptyDefaultConfig: Configuration = {
  name: "otel.instrumentation.http.client.captured-headers",
  declarative_name: "general.http.client.request_captured_headers",
  description: "Headers to capture on the client.",
  type: "list",
  default: "",
};

const exampleConfig: Configuration = {
  name: "otel.instrumentation.http.example",
  description: "Example field.",
  type: "string",
  default: "x",
  example: ["foo", "bar"],
};

describe("InstrumentationConfigurationTab", () => {
  it("renders the empty state when there are no configurations", () => {
    render(<InstrumentationConfigurationTab configurations={[]} />);
    expect(screen.getByText("No configuration options available.")).toBeInTheDocument();
  });

  it("renders a card per configuration with name, type and description", () => {
    render(<InstrumentationConfigurationTab configurations={[baseConfig]} />);
    expect(screen.getByText(baseConfig.name)).toBeInTheDocument();
    expect(screen.getByText("list")).toBeInTheDocument();
    expect(screen.getByText("Known HTTP methods.")).toBeInTheDocument();
  });

  it("defaults to System Properties format and shows the flat name", () => {
    render(<InstrumentationConfigurationTab configurations={[baseConfig]} />);
    const nameEl = screen.getByTestId("config-name");
    expect(nameEl.textContent).toBe(baseConfig.name);
    expect(nameEl.tagName).toBe("CODE");
  });

  it("switches to Declarative format and renders nested YAML", async () => {
    const user = userEvent.setup();
    render(<InstrumentationConfigurationTab configurations={[baseConfig]} />);
    await user.click(screen.getByRole("tab", { name: "Declarative" }));

    const nameEl = screen.getByTestId("config-name");
    expect(nameEl.tagName).toBe("PRE");
    expect(nameEl.textContent).toContain("java:");
    expect(nameEl.textContent).toContain("known_methods: <value>");
  });

  it("renders a `dev` stability badge when declarative_name has /development suffix", () => {
    render(<InstrumentationConfigurationTab configurations={[stableDevConfig]} />);
    expect(screen.getByText("dev")).toBeInTheDocument();
  });

  it("does not render a stability badge for stable configs", () => {
    render(<InstrumentationConfigurationTab configurations={[baseConfig]} />);
    expect(screen.queryByText("dev")).not.toBeInTheDocument();
  });

  it("renders `(empty)` for blank default values", () => {
    render(<InstrumentationConfigurationTab configurations={[emptyDefaultConfig]} />);
    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });

  it("renders boolean defaults as their string form", () => {
    render(<InstrumentationConfigurationTab configurations={[stableDevConfig]} />);
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  it("renders an Examples section when example array is non-empty", () => {
    render(<InstrumentationConfigurationTab configurations={[exampleConfig]} />);
    expect(screen.getByText("Examples:")).toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
  });

  it("does not render Examples section when example is missing", () => {
    render(<InstrumentationConfigurationTab configurations={[baseConfig]} />);
    expect(screen.queryByText("Examples:")).not.toBeInTheDocument();
  });

  it("falls back to flat name in Declarative mode if declarative_name is missing", async () => {
    const user = userEvent.setup();
    render(<InstrumentationConfigurationTab configurations={[exampleConfig]} />);
    await user.click(screen.getByRole("tab", { name: "Declarative" }));
    const nameEl = screen.getByTestId("config-name");
    expect(nameEl.textContent).toBe(exampleConfig.name);
    expect(nameEl.tagName).toBe("CODE");
  });
});
