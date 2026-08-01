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
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import { CardView, CompactList, TableView, type ListRow } from "./views";

const rows: ListRow[] = [
  {
    id: "otlp-receiver",
    name: "otlpreceiver",
    displayName: "OTLP Receiver",
    type: "receiver",
    distribution: "core",
    description: "Receives telemetry via gRPC or HTTP in OTLP format.",
    stability: "stable",
    signals: ["traces", "metrics", "logs"],
    href: "/collector/components/otlpreceiver",
  },
  {
    id: "kafka-exporter",
    name: "kafkaexporter",
    displayName: "Kafka Exporter",
    type: "exporter",
    distribution: "contrib",
    description: null,
    stability: "alpha",
    signals: [],
    href: "/collector/components/kafkaexporter",
  },
];

const renderCompactList = () =>
  render(
    <MemoryRouter>
      <CompactList rows={rows} />
    </MemoryRouter>
  );

const renderCardView = () =>
  render(
    <MemoryRouter>
      <CardView rows={rows} />
    </MemoryRouter>
  );

const renderTableView = () =>
  render(
    <MemoryRouter>
      <TableView rows={rows} />
    </MemoryRouter>
  );

describe("CompactList", () => {
  it("renders one link per row", () => {
    renderCompactList();
    expect(screen.getAllByRole("link")).toHaveLength(rows.length);
  });

  it("renders each row as a link to its detail href", () => {
    renderCompactList();
    const link = screen.getByRole("link", { name: /OTLP Receiver/ });
    expect(link).toHaveAttribute("href", "/collector/components/otlpreceiver");
  });

  it("renders name, slug, type, signals, and status pill for a row", () => {
    renderCompactList();
    const row = screen.getByRole("link", { name: /OTLP Receiver/ });
    expect(within(row).getByText("otlpreceiver")).toBeInTheDocument();
    expect(within(row).getByText("receiver")).toBeInTheDocument();
    expect(within(row).getByText("traces, metrics, logs")).toBeInTheDocument();
    expect(within(row).getByText("Stable")).toBeInTheDocument();
  });

  it("omits description and signals when a row has none", () => {
    renderCompactList();
    const row = screen.getByRole("link", { name: /Kafka Exporter/ });
    expect(within(row).queryByText(/Receives telemetry/)).not.toBeInTheDocument();
    expect(within(row).getByText("Alpha")).toBeInTheDocument();
  });
});

describe("CardView", () => {
  it("renders one card link per row", () => {
    renderCardView();
    expect(screen.getAllByRole("link")).toHaveLength(rows.length);
  });

  it("renders name, slug, description, distribution, and status pill on a card", () => {
    renderCardView();
    const card = screen.getByRole("link", { name: /OTLP Receiver/ });
    expect(card).toHaveAttribute("href", "/collector/components/otlpreceiver");
    expect(within(card).getByText("otlpreceiver")).toBeInTheDocument();
    expect(within(card).getByText(/Receives telemetry via gRPC/)).toBeInTheDocument();
    expect(within(card).getByText("core")).toBeInTheDocument();
    expect(within(card).getByText("Stable")).toBeInTheDocument();
  });
});

describe("TableView", () => {
  it("renders a table with all five column headers", () => {
    renderTableView();
    expect(screen.getByRole("table")).toBeInTheDocument();
    for (const header of ["Name", "Type", "Signals", "Distribution", "Stability"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
  });

  it("renders one body row per item", () => {
    renderTableView();
    // Header row + one row per item.
    expect(screen.getAllByRole("row")).toHaveLength(rows.length + 1);
  });

  it("links the name cell to the detail href with the slug alongside", () => {
    renderTableView();
    const link = screen.getByRole("link", { name: /Kafka Exporter/ });
    expect(link).toHaveAttribute("href", "/collector/components/kafkaexporter");
    expect(within(link).getByText("kafkaexporter")).toBeInTheDocument();
  });

  it("renders signals joined and an em dash when a row has none", () => {
    renderTableView();
    const [, otlpRow, kafkaRow] = screen.getAllByRole("row");
    expect(within(otlpRow).getByText("traces, metrics, logs")).toBeInTheDocument();
    expect(within(kafkaRow).getByText("—")).toBeInTheDocument();
  });

  it("renders a status pill per row", () => {
    renderTableView();
    const [, otlpRow, kafkaRow] = screen.getAllByRole("row");
    expect(within(otlpRow).getByText("Stable")).toBeInTheDocument();
    expect(within(kafkaRow).getByText("Alpha")).toBeInTheDocument();
  });
});
