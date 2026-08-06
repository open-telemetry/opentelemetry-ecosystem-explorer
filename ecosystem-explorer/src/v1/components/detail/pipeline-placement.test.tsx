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
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import { PipelinePlacement } from "./pipeline-placement";

function renderPlacement(type: Parameters<typeof PipelinePlacement>[0]["activeType"]) {
  return render(
    <MemoryRouter>
      <PipelinePlacement activeType={type} activeName="OTLP Receiver" />
    </MemoryRouter>
  );
}

describe("PipelinePlacement", () => {
  it("renders the receiver → processor → exporter pipeline with the active stage highlighted", () => {
    renderPlacement("receiver");

    expect(screen.getByRole("heading", { name: "Where this fits" })).toBeInTheDocument();
    // The active receiver stage shows the component name and is not a link.
    expect(screen.getByText("OTLP Receiver")).toBeInTheDocument();
    // The other stages link into the filtered list page.
    expect(screen.getByRole("link", { name: "Processors" })).toHaveAttribute(
      "href",
      "/collector/components?type=processor"
    );
    expect(screen.getByRole("link", { name: "Exporters" })).toHaveAttribute(
      "href",
      "/collector/components?type=exporter"
    );
  });

  it("renders a single-stage pipeline for extensions", () => {
    renderPlacement("extension");

    expect(screen.getByText("Extensions")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("bridges receiver and exporter pipelines for connectors", () => {
    renderPlacement("connector");

    expect(screen.getByRole("link", { name: "Receivers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exporters" })).toBeInTheDocument();
    expect(screen.getByText("Connectors")).toBeInTheDocument();
  });
});
