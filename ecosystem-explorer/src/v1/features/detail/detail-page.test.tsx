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
} from "@/hooks/use-collector-data";
import type { CollectorComponent, IndexComponent } from "@/types/collector";

vi.mock("@/hooks/use-collector-data", () => ({
  useCollectorComponent: vi.fn(),
  useCollectorComponents: vi.fn(),
  useCollectorVersions: vi.fn(),
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
}) {
  vi.mocked(useCollectorVersions).mockReturnValue({
    data: { versions: [{ version: "0.150.0", is_latest: true }] },
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
    expect(screen.getByText("boom")).toBeInTheDocument();
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
