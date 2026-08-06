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
import { render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollectorExploreLanding } from "./collector-explore-landing";
import { useCollectorIndex, useCollectorVersions } from "@/hooks/use-collector-data";
import type { CollectorIndex } from "@/types/collector";

vi.mock("@/hooks/use-collector-data", () => ({
  useCollectorIndex: vi.fn(),
  useCollectorVersions: vi.fn(),
}));

const collectorIndex = {
  ecosystem: "collector",
  taxonomy: {
    distributions: ["core", "contrib"],
    types: ["receiver", "processor", "exporter", "extension", "connector"],
  },
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
} satisfies CollectorIndex;

describe("CollectorExploreLanding", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCollectorIndex).mockReturnValue({
      data: collectorIndex,
      loading: false,
      error: null,
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
    });
  });

  it("renders counts, links, and the latest version from Collector data", () => {
    render(
      <MemoryRouter>
        <CollectorExploreLanding />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Component Types" })).toBeInTheDocument();
    expect(screen.getByText(/latest data version/i)).toBeInTheDocument();
    expect(screen.getByText(/v0\.150\.0/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Receiver/i })).toHaveAttribute(
      "href",
      "/collector/components?type=receiver"
    );
    expect(screen.getByRole("link", { name: /View Core Components/i })).toHaveAttribute(
      "href",
      "/collector/components?distribution=core"
    );
    expect(screen.getByRole("link", { name: /View Contrib Components/i })).toHaveAttribute(
      "href",
      "/collector/components?distribution=contrib"
    );

    const stats = screen.getByLabelText("Collector summary statistics");
    expect(within(stats).getAllByText("5")).toHaveLength(2);
    expect(within(stats).getByText("2")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Official Documentation/i })).toHaveAttribute(
      "href",
      "https://opentelemetry.io/docs/collector/"
    );
  });

  it("renders a loading state while Collector data is loading", () => {
    vi.mocked(useCollectorIndex).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    render(
      <MemoryRouter>
        <CollectorExploreLanding />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading Collector ecosystem data...")).toBeInTheDocument();
  });

  it("renders an error state when the Collector index request fails", async () => {
    vi.mocked(useCollectorIndex).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Collector index request failed with 404."),
    });

    render(
      <MemoryRouter>
        <CollectorExploreLanding />
      </MemoryRouter>
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Error loading Collector data");
    expect(screen.getByText("Collector index request failed with 404.")).toBeInTheDocument();
  });

  it("renders translated content when the language is switched to Spanish", async () => {
    const collectorEs = await import("../../../../public/locales/es/collector.json");
    i18n.addResourceBundle("es", "collector", collectorEs.default, true, true);
    await i18n.changeLanguage("es");

    render(
      <MemoryRouter>
        <CollectorExploreLanding />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Tipos de componentes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Receptor/i })).toHaveAttribute(
      "href",
      "/collector/components?type=receiver"
    );
    expect(screen.getByRole("link", { name: /Ver componentes Core/i })).toBeInTheDocument();
    expect(screen.queryByText("Component Types")).not.toBeInTheDocument();
  });
});
