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
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ContribComponent, ContribEntry } from "@/types/java-contrib";
import { JavaContribListPage } from "./java-contrib-list-page";
import { JavaContribDetailPage } from "./java-contrib-detail-page";

vi.mock("./hooks/use-java-contrib", () => ({
  useContribComponents: vi.fn(),
  useContribComponent: vi.fn(),
}));

vi.mock("@/components/ui/back-button", () => ({
  BackButton: () => <button>Back</button>,
}));

import { useContribComponents, useContribComponent } from "./hooks/use-java-contrib";

const SPAN_STACKTRACE: ContribComponent = {
  name: "span-stacktrace",
  display_name: "Span Stacktrace Capture",
  description: "Adds a code.stacktrace attribute to qualifying spans.",
  source_path: "span-stacktrace",
  component_types: ["library"],
  docs_url: "https://example.com/span-stacktrace",
  usage: "Include the artifact in application runtime dependencies.",
  status: { stability: "alpha" },
  artifact: { group_id: "io.opentelemetry.contrib", artifact_id: "opentelemetry-span-stacktrace" },
  min_java_version: 8,
  distributions: [],
  configurations: [
    {
      type: "sdk-autoconfiguration",
      display_name: "SDK autoconfiguration properties",
      description: "Set these system properties as JVM arguments.",
      example: { language: "shell", code: "-Dotel.min.duration=10ms" },
      settings: [
        {
          name: "otel.java.experimental.span-stacktrace.filter",
          type: "string",
          default: null,
          description: "Predicate class name.",
        },
      ],
    },
    {
      type: "declarative",
      component_key: "stacktrace/development",
      location: "tracer_provider.processors[]",
      display_name: "Declarative SDK configuration",
      description: "Add stacktrace/development to tracer_provider.processors.",
      example: { language: "yaml", code: "file_format: '1.0'" },
      settings: [
        {
          name: "min_duration",
          type: "int",
          unit: "ms",
          default: 5,
          description: "Minimum duration in ms.",
        },
      ],
    },
  ],
};

const ENTRIES: ContribEntry[] = [
  { id: "span-stacktrace", component: SPAN_STACKTRACE, problems: [] },
  {
    id: "inferred-spans",
    problems: [],
    component: {
      ...SPAN_STACKTRACE,
      name: "inferred-spans",
      display_name: "Inferred Spans",
      source_path: "inferred-spans",
      component_types: ["agent-extension"],
      status: { stability: "deprecated", replaced_by: "span-stacktrace" },
      distributions: [
        {
          name: "javaagent",
          repository_url: "https://github.com/open-telemetry/opentelemetry-java-instrumentation",
        },
      ],
      artifact: undefined,
      configurations: [],
    },
  },
];

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/java-agent/extensions" element={<JavaContribListPage />} />
        <Route path="/java-agent/extensions/:name" element={<JavaContribDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("JavaContribListPage", () => {
  beforeEach(() => {
    vi.mocked(useContribComponents).mockReturnValue({ data: ENTRIES, loading: false, error: null });
  });

  it("lists every component linking to its detail page", () => {
    renderAt("/java-agent/extensions");
    expect(screen.getByText("2 extensions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View details for Inferred Spans" })).toHaveAttribute(
      "href",
      "/java-agent/extensions/inferred-spans"
    );
  });

  it("filters by component type with a pressed toggle", async () => {
    const user = userEvent.setup();
    renderAt("/java-agent/extensions");
    const toggle = screen.getByRole("button", { name: "Agent extension" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 extension")).toBeInTheDocument();
    expect(screen.queryByText("Span Stacktrace Capture")).not.toBeInTheDocument();
  });

  it("filters by distribution", async () => {
    const user = userEvent.setup();
    renderAt("/java-agent/extensions");
    await user.click(screen.getByRole("button", { name: "Bundled in Java agent" }));
    expect(screen.getByText("1 extension")).toBeInTheDocument();
    expect(screen.getByText("Inferred Spans")).toBeInTheDocument();
  });

  it("shows the load error", () => {
    vi.mocked(useContribComponents).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("boom"),
    });
    renderAt("/java-agent/extensions");
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});

describe("JavaContribDetailPage", () => {
  it("renders install snippets and a tab per configuration method", async () => {
    vi.mocked(useContribComponent).mockReturnValue({
      data: ENTRIES[0],
      loading: false,
      error: null,
    });
    const user = userEvent.setup();
    renderAt("/java-agent/extensions/span-stacktrace");

    expect(
      screen.getByRole("heading", { level: 1, name: "Span Stacktrace Capture" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("io.opentelemetry.contrib:opentelemetry-span-stacktrace")
    ).toBeInTheDocument();

    const [setting] = screen.getAllByTestId("contrib-setting");
    expect(within(setting).getByText("not set")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Declarative SDK configuration" }));
    const [declarative] = screen.getAllByTestId("contrib-setting");
    expect(within(declarative).getByText("min_duration")).toBeInTheDocument();
    expect(within(declarative).getByText("5")).toBeInTheDocument();
    expect(within(declarative).getByText("ms")).toBeInTheDocument();
    expect(
      within(declarative).getByText(
        "tracer_provider.processors[].stacktrace/development.min_duration"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/This extension is deprecated/)).not.toBeInTheDocument();
  });

  it("shows deprecation with a link to the replacement, and bundled distributions", () => {
    vi.mocked(useContribComponent).mockReturnValue({
      data: ENTRIES[1],
      loading: false,
      error: null,
    });
    renderAt("/java-agent/extensions/inferred-spans");
    expect(screen.getByRole("note")).toHaveTextContent(
      "This extension is deprecated. Use span-stacktrace instead."
    );
    expect(screen.getByRole("link", { name: "span-stacktrace" })).toHaveAttribute(
      "href",
      "/java-agent/extensions/span-stacktrace"
    );
    expect(screen.getByText("Bundled in Java agent")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OpenTelemetry Java agent" })).toHaveAttribute(
      "href",
      "https://github.com/open-telemetry/opentelemetry-java-instrumentation"
    );
  });

  it("hides installation without an artifact and shows the no-configuration state", () => {
    vi.mocked(useContribComponent).mockReturnValue({
      data: ENTRIES[1],
      loading: false,
      error: null,
    });
    renderAt("/java-agent/extensions/inferred-spans");
    expect(screen.queryByRole("heading", { name: "Installation" })).not.toBeInTheDocument();
    expect(screen.getByText("This extension has no configuration methods.")).toBeInTheDocument();
  });

  it("shows a not-found state when loading fails", () => {
    vi.mocked(useContribComponent).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed to load contrib component nope: 404"),
    });
    renderAt("/java-agent/extensions/nope");
    expect(screen.getByText('Extension "nope" was not found')).toBeInTheDocument();
  });
});
