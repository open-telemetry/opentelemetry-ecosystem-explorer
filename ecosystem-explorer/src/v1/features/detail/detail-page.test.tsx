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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollectorDetailPageV1 } from "./detail-page";
import {
  useCollectorComponent,
  useCollectorComponents,
  useCollectorVersions,
  useComponentVersions,
} from "@/hooks/use-collector-data";
import type { CollectorComponent, IndexComponent } from "@/types/collector";

vi.mock("@/hooks/use-collector-data", () => ({
  useCollectorComponent: vi.fn(),
  useCollectorComponents: vi.fn(),
  useCollectorVersions: vi.fn(),
  useComponentVersions: vi.fn(),
}));

const component: CollectorComponent = {
  id: "core-otlpreceiver",
  name: "otlpreceiver",
  ecosystem: "collector",
  type: "receiver",
  distribution: "core",
  display_name: "OTLP Receiver",
  description: "Receives data via OTLP.",
  repository: "opentelemetry-collector",
  status: {
    class: "receiver",
    stability: { stable: ["traces", "metrics", "logs"] },
    distributions: ["core"],
  },
  metrics: {
    otelcol_receiver_accepted_spans: {
      description: "Number of spans successfully pushed into the pipeline.",
      enabled: true,
      unit: "1",
    },
  },
  attributes: {
    transport: { description: "The transport protocol.", type: "string" },
  },
  resource_attributes: {
    "service.name": { description: "The service name.", type: "string" },
  },
};

const siblings: IndexComponent[] = [
  { id: "core-otlpreceiver", name: "otlpreceiver", distribution: "core", type: "receiver" },
  { id: "contrib-kafkareceiver", name: "kafkareceiver", distribution: "contrib", type: "receiver" },
  { id: "core-batchprocessor", name: "batchprocessor", distribution: "core", type: "processor" },
];

function mockHooks(overrides?: {
  componentState?: Partial<ReturnType<typeof useCollectorComponent>>;
  versionsState?: Partial<ReturnType<typeof useCollectorVersions>>;
  componentsState?: Partial<ReturnType<typeof useCollectorComponents>>;
  componentVersionsState?: Partial<ReturnType<typeof useComponentVersions>>;
}) {
  vi.mocked(useComponentVersions).mockReturnValue({
    data: ["0.150.0", "0.149.0"],
    loading: false,
    error: null,
    ...overrides?.componentVersionsState,
  });
  vi.mocked(useCollectorVersions).mockReturnValue({
    data: {
      versions: [
        { version: "0.150.0", is_latest: true },
        { version: "0.149.0", is_latest: false },
      ],
    },
    loading: false,
    error: null,
    ...overrides?.versionsState,
  });
  vi.mocked(useCollectorComponent).mockReturnValue({
    data: component,
    loading: false,
    error: null,
    ...overrides?.componentState,
  });
  vi.mocked(useCollectorComponents).mockReturnValue({
    data: siblings,
    loading: false,
    error: null,
    ...overrides?.componentsState,
  });
}

function renderAtRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/collector/components/:distribution/:name"
          element={<CollectorDetailPageV1 />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("CollectorDetailPageV1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
  });

  it("resolves the latest version and renders when the URL carries no ?version=", () => {
    // Regression guard: the list page links to a bare
    // /collector/components/:distribution/:name (no ?version=). Without the
    // is_latest fallback, useCollectorComponent gets an empty version and the
    // page renders "not found".
    mockHooks();

    renderAtRoute("/collector/components/core/otlpreceiver");

    expect(screen.getByRole("heading", { name: "OTLP Receiver" })).toBeInTheDocument();
    expect(screen.queryByText("Component not found")).not.toBeInTheDocument();
  });

  it("shows the loading state while versions are in flight and no ?version= is present", () => {
    mockHooks({
      versionsState: { data: null, loading: true, error: null },
      componentState: { data: null, loading: false, error: null },
    });

    renderAtRoute("/collector/components/core/otlpreceiver");

    expect(screen.getByText("Loading component…")).toBeInTheDocument();
  });

  it("shows the not-found state when the component fails to load", () => {
    mockHooks({
      componentState: { data: null, loading: false, error: new Error("boom") },
    });

    renderAtRoute("/collector/components/core/otlpreceiver");

    expect(screen.getByRole("alert")).toHaveTextContent("Component not found");
    // The raw exception text is a stack-trace-grade string; users get the copy.
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/The registry has no entry/);
  });

  it("names the release a component is missing from and links one that has it", () => {
    // Reaching a version the component was never in is an expected state, not
    // a load failure, so it gets its own answer plus a way out.
    mockHooks({
      componentVersionsState: { data: ["0.150.0"] },
      componentState: { data: null, loading: false, error: new Error("not found in 0.149.0") },
    });

    renderAtRoute("/collector/components/core/otlpreceiver?version=0.149.0");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Not in this release");
    expect(alert).toHaveTextContent(/0\.149\.0/);
    expect(alert).not.toHaveTextContent("not found in 0.149.0");
    expect(screen.getByRole("link", { name: "View 0.150.0 instead" })).toHaveAttribute(
      "href",
      "/collector/components/core/otlpreceiver?version=0.150.0"
    );
  });

  it("waits for the release list before classifying a failed load", () => {
    // Without the wait, the generic not-found flashes and is replaced a tick later.
    mockHooks({
      componentVersionsState: { data: null, loading: true, error: null },
      componentState: { data: null, loading: false, error: new Error("boom") },
    });

    renderAtRoute("/collector/components/core/otlpreceiver?version=0.149.0");

    expect(screen.getByRole("status")).toHaveTextContent("Loading component…");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("builds sibling links as /distribution/name and drops non-matching types", () => {
    mockHooks();

    renderAtRoute("/collector/components/core/otlpreceiver");

    // Same-type siblings are listed with distribution/name hrefs.
    expect(screen.getByRole("link", { name: /kafkareceiver/ })).toHaveAttribute(
      "href",
      "/collector/components/contrib/kafkareceiver"
    );
    // A processor is filtered out of the receiver's sibling list.
    expect(screen.queryByRole("link", { name: /batchprocessor/ })).not.toBeInTheDocument();
  });

  it("preserves an explicit ?version= on sibling links", () => {
    mockHooks();

    renderAtRoute("/collector/components/core/otlpreceiver?version=0.149.0");

    expect(screen.getByRole("link", { name: /kafkareceiver/ })).toHaveAttribute(
      "href",
      "/collector/components/contrib/kafkareceiver?version=0.149.0"
    );
  });

  it("renders the right rail: version timeline, diff selector, and compatibility card", () => {
    mockHooks();

    renderAtRoute("/collector/components/core/otlpreceiver");

    // Right-rail landmark, disambiguated from the left rail by its label.
    expect(
      screen.getByRole("complementary", { name: "Version history and compatibility" })
    ).toBeInTheDocument();

    // Timeline links the current version back to itself with an explicit ?version=.
    expect(screen.getByRole("heading", { name: "Version history" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "0.150.0" })).toHaveAttribute(
      "href",
      "/collector/components/core/otlpreceiver?version=0.150.0"
    );

    // Diff selector defaults to previous -> current and builds the query-param diff link.
    expect(screen.getByRole("link", { name: /Diff/ })).toHaveAttribute(
      "href",
      "/collector/components/core/otlpreceiver/diff?from=0.149.0&to=0.150.0"
    );

    // Compatibility card renders (it returns null unless distributions exist).
    expect(screen.getByRole("heading", { name: "Compatibility" })).toBeInTheDocument();
  });

  it("lists only the releases the component actually appears in", () => {
    // Regression: the rail was fed the global versions index, so a component
    // introduced in the newest release still linked every older version. Those
    // links resolve to a manifest with no entry for the component, and the page
    // renders "not found".
    mockHooks({ componentVersionsState: { data: ["0.150.0"] } });

    renderAtRoute("/collector/components/core/otlpreceiver");

    expect(screen.getByRole("link", { name: "0.150.0" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "0.149.0" })).not.toBeInTheDocument();
  });

  it("hides the diff selector when the component exists in a single release", () => {
    // Nothing to compare against, so the selector renders nothing rather than
    // offering a diff whose `from` version has no manifest entry.
    mockHooks({ componentVersionsState: { data: ["0.150.0"] } });

    renderAtRoute("/collector/components/core/otlpreceiver");

    expect(screen.queryByRole("link", { name: /Diff/ })).not.toBeInTheDocument();
  });

  it("shows only the viewed release while component versions are in flight", () => {
    // The fallback must not be the global index: rendering it during the fetch
    // would make the dead links clickable for exactly that window.
    mockHooks({ componentVersionsState: { data: null, loading: true, error: null } });

    renderAtRoute("/collector/components/core/otlpreceiver?version=0.149.0");

    expect(screen.getByRole("link", { name: "0.149.0" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "0.150.0" })).not.toBeInTheDocument();
  });

  it("defaults the diff selector to a pair drawn from the filtered releases", () => {
    // 0.148.0 is in the component's own history but not in the two-entry global
    // index the other tests mock, proving the selector reads the filtered list.
    mockHooks({ componentVersionsState: { data: ["0.150.0", "0.148.0"] } });

    renderAtRoute("/collector/components/core/otlpreceiver");

    expect(screen.getByRole("link", { name: /Diff/ })).toHaveAttribute(
      "href",
      "/collector/components/core/otlpreceiver/diff?from=0.148.0&to=0.150.0"
    );
  });

  it("wires component telemetry into the attributes tab", async () => {
    const user = userEvent.setup();
    mockHooks();

    renderAtRoute("/collector/components/core/otlpreceiver");

    await user.click(screen.getByRole("tab", { name: "Attributes" }));

    expect(screen.getByText("otelcol_receiver_accepted_spans")).toBeInTheDocument();
    expect(screen.getByText("transport")).toBeInTheDocument();
    expect(screen.getByText("service.name")).toBeInTheDocument();
    expect(screen.getByText("Metric")).toBeInTheDocument();
    expect(screen.getByText("Resource attribute")).toBeInTheDocument();
  });

  it("switches tabs from the on-page anchor instead of leaving a dead hash link", async () => {
    // Regression: on-page tab anchors and the tablist once shared the same
    // hash namespace, so clicking an anchor for an inactive tab flipped the
    // tab as a side effect and never scrolled. The anchor is now a button that
    // drives the tab switch directly.
    const user = userEvent.setup();
    mockHooks();

    renderAtRoute("/collector/components/core/otlpreceiver");

    // Configuration is the default tab; its empty state is showing.
    expect(screen.getByText("No configuration schema yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Emitted attributes" }));

    expect(screen.getByText("otelcol_receiver_accepted_spans")).toBeInTheDocument();
    expect(window.location.hash).toBe("#attributes");
  });
});
