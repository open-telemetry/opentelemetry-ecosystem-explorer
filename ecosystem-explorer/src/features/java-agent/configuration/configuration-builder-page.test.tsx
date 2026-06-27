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
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { GroupNode } from "@/types/configuration";
import { ConfigurationBuilderPage } from "./configuration-builder-page";

/*
 * These tests pin the loading and error states of ConfigurationBuilderPage,
 * which must be handled OUTSIDE the ConfigurationBuilderProvider. The provider
 * is hoisted above <Tabs> so builder state survives tab switches, but gating
 * its mount also gates the loader and error UI — earlier that swallowed both
 * into a blank screen while the schema/starter loaded or failed. The data hooks
 * set `data: null` whenever they are loading or have errored, so `root` is null
 * in exactly those windows; these tests assert the page still shows feedback.
 */

const mocks = vi.hoisted(() => {
  const idle = { data: null as unknown, loading: false, error: null as Error | null };
  return {
    configVersions: { ...idle },
    configSchema: { ...idle },
    configStarter: { ...idle },
    agentVersions: { ...idle },
    instrumentations: { ...idle },
  };
});

vi.mock("@/hooks/use-configuration-data", () => ({
  useConfigVersions: () => mocks.configVersions,
  useConfigSchema: () => mocks.configSchema,
  useConfigStarter: () => mocks.configStarter,
}));

vi.mock("@/hooks/use-javaagent-data", () => ({
  useVersions: () => mocks.agentVersions,
  useInstrumentations: () => mocks.instrumentations,
}));

const ROOT_SCHEMA: GroupNode = {
  controlType: "group",
  key: "root",
  label: "Root",
  path: "",
  children: [],
};

const VERSIONS_OK = {
  data: { versions: [{ version: "1.0.0", is_latest: true }] },
  loading: false,
  error: null,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ConfigurationBuilderPage />
    </MemoryRouter>
  );
}

describe("ConfigurationBuilderPage loading/error states", () => {
  beforeEach(() => {
    // Reset to a benign idle baseline; each test overrides what it needs.
    mocks.configVersions = { data: null, loading: false, error: null };
    mocks.configSchema = { data: null, loading: false, error: null };
    mocks.configStarter = { data: null, loading: false, error: null };
    mocks.agentVersions = { data: null, loading: false, error: null };
    mocks.instrumentations = { data: null, loading: false, error: null };
  });

  it("shows the versions loader while the versions index is loading", () => {
    mocks.configVersions = { data: null, loading: true, error: null };
    renderPage();
    expect(screen.getByText("Loading versions…")).toBeInTheDocument();
  });

  it("shows the versions error when the versions index fails", () => {
    mocks.configVersions = { data: null, loading: false, error: new Error("boom") };
    renderPage();
    expect(screen.getByText("Failed to load available versions.")).toBeInTheDocument();
  });

  it("shows the schema loader (not a blank screen) while the schema is still loading", () => {
    // Versions resolved, but schema/starter are mid-flight: `root` is null here.
    mocks.configVersions = VERSIONS_OK;
    mocks.configSchema = { data: null, loading: true, error: null };
    mocks.configStarter = { data: null, loading: true, error: null };
    renderPage();
    expect(screen.getByText("Loading schema…")).toBeInTheDocument();
    // The provider/tabs must not mount until data is ready.
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("shows the schema error (not a blank screen) when the schema fails to load", () => {
    mocks.configVersions = VERSIONS_OK;
    mocks.configSchema = { data: null, loading: false, error: new Error("bad schema") };
    mocks.configStarter = { data: null, loading: false, error: null };
    renderPage();
    expect(screen.getByText("Failed to load schema.")).toBeInTheDocument();
    expect(screen.queryByText("Loading schema…")).toBeNull();
  });

  it("shows the starter-template error when the schema loaded but the starter failed", () => {
    mocks.configVersions = VERSIONS_OK;
    mocks.configSchema = { data: ROOT_SCHEMA, loading: false, error: null };
    mocks.configStarter = { data: null, loading: false, error: new Error("bad starter") };
    renderPage();
    expect(screen.getByText("Failed to load starter template.")).toBeInTheDocument();
    // The builder tabs must not render while the starter is in an error state.
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("hides schema versions above the supported ceiling and pins to the latest supported", () => {
    // The registry advertises 1.1.0 as latest, but the builder UI only supports
    // up to MAX_SUPPORTED_CONFIG_SCHEMA_VERSION (1.0.0). The selector must drop
    // 1.1.0 and default to 1.0.0, re-labelled "(latest)".
    mocks.configVersions = {
      data: {
        versions: [
          { version: "1.1.0", is_latest: true },
          { version: "1.0.0", is_latest: false },
        ],
      },
      loading: false,
      error: null,
    };
    mocks.configSchema = { data: ROOT_SCHEMA, loading: false, error: null };
    mocks.configStarter = { data: null, loading: false, error: null };
    renderPage();

    const select = screen.getByLabelText("Schema") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["1.0.0"]);
    expect(select.value).toBe("1.0.0");
    expect(screen.queryByRole("option", { name: /1\.1\.0/ })).toBeNull();
    expect(screen.getByRole("option", { name: "1.0.0 (latest)" })).toBeInTheDocument();
  });
});
