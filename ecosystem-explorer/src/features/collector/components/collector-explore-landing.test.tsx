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
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollectorExploreLanding } from "./collector-explore-landing";
import { loadVersions } from "@/lib/api/collector-data";

vi.mock("@/lib/api/collector-data", () => ({
  loadVersions: vi.fn(),
}));

const collectorIndex = {
  components: [
    {
      id: "core-receiver-otlpreceiver",
      name: "otlpreceiver",
      display_name: "OTLP Receiver",
      description: "Receives OTLP telemetry.",
      distribution: "core",
      type: "receiver",
      stability: "stable",
    },
    {
      id: "contrib-receiver-prometheusreceiver",
      name: "prometheusreceiver",
      display_name: "Prometheus Receiver",
      description: "Receives Prometheus metrics.",
      distribution: "contrib",
      type: "receiver",
      stability: "stable",
    },
    {
      id: "core-processor-batchprocessor",
      name: "batchprocessor",
      display_name: "Batch Processor",
      description: "Batches telemetry.",
      distribution: "core",
      type: "processor",
      stability: "stable",
    },
    {
      id: "contrib-exporter-kafkaexporter",
      name: "kafkaexporter",
      display_name: "Kafka Exporter",
      description: "Exports to Kafka.",
      distribution: "contrib",
      type: "exporter",
      stability: "beta",
    },
    {
      id: "contrib-extension-healthcheckextension",
      name: "healthcheckextension",
      display_name: "Health Check Extension",
      description: "Reports collector health.",
      distribution: "contrib",
      type: "extension",
      stability: "stable",
    },
  ],
};

function mockCollectorIndexResponse(response: Response) {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response));
}

describe("CollectorExploreLanding", () => {
  beforeEach(() => {
    vi.mocked(loadVersions).mockResolvedValue({
      versions: [
        { version: "0.150.0", is_latest: true },
        { version: "0.149.0", is_latest: false },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders counts, links, and the latest version from Collector data", async () => {
    mockCollectorIndexResponse(
      new Response(JSON.stringify(collectorIndex), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(
      <MemoryRouter>
        <CollectorExploreLanding />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading Collector ecosystem data...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Component Types" })).toBeInTheDocument();
    });

    expect(screen.getByText("Latest Collector data: v0.150.0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore Components/i })).toHaveAttribute(
      "href",
      "/collector/components"
    );
    expect(screen.getByRole("link", { name: /Receiver/i })).toHaveAttribute(
      "href",
      "/collector/components?type=receiver"
    );
    expect(screen.getByRole("link", { name: /View Core Components/i })).toHaveAttribute(
      "href",
      "/collector/components?distribution=core"
    );

    const stats = screen.getByLabelText("Collector summary statistics");
    expect(within(stats).getAllByText("5")).toHaveLength(2);
    expect(within(stats).getByText("2")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Official Documentation/i })).toHaveAttribute(
      "href",
      "https://opentelemetry.io/docs/collector/"
    );
  });

  it("renders an error state when the Collector index request fails", async () => {
    mockCollectorIndexResponse(new Response("Not found", { status: 404 }));

    render(
      <MemoryRouter>
        <CollectorExploreLanding />
      </MemoryRouter>
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Error loading Collector data");
    expect(screen.getByText("Collector index request failed with 404.")).toBeInTheDocument();
  });
});
