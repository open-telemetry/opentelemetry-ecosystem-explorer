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
import { describe, it, expect } from "vitest";

import { DetailHeader } from "./detail-header";

describe("DetailHeader", () => {
  it("renders the title, slug, eyebrow, and localized stability label", () => {
    render(
      <DetailHeader
        type="receiver"
        distribution="core"
        displayName="OTLP Receiver"
        slug="otlpreceiver"
        description="Receives telemetry via OTLP."
        stability="stable"
        version="0.150.0"
        signals={["traces", "metrics"]}
        hrefRepository={null}
        hrefDocs={null}
      />
    );

    expect(screen.getByRole("heading", { name: "OTLP Receiver" })).toBeInTheDocument();
    expect(screen.getByText("otlpreceiver")).toBeInTheDocument();
    expect(screen.getByText("Receives telemetry via OTLP.")).toBeInTheDocument();
    // Stability string maps to the collector-namespace label, not the raw key.
    expect(screen.getByText("Stable")).toBeInTheDocument();
    expect(screen.getByText("traces")).toBeInTheDocument();
    expect(screen.getByText("metrics")).toBeInTheDocument();
  });

  it("renders a source link that opens safely in a new tab when a repository href is given", () => {
    render(
      <DetailHeader
        type="receiver"
        distribution="core"
        displayName="OTLP Receiver"
        slug="otlpreceiver"
        stability="stable"
        version="0.150.0"
        signals={[]}
        hrefRepository="https://github.com/open-telemetry/opentelemetry-collector/tree/main/receiver/otlpreceiver"
        hrefDocs={null}
      />
    );

    const link = screen.getByRole("link", { name: /source/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/open-telemetry/opentelemetry-collector/tree/main/receiver/otlpreceiver"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders no actions when neither a repository nor a docs href is given", () => {
    render(
      <DetailHeader
        type="extension"
        distribution="core"
        displayName="Health Check"
        slug="healthcheckextension"
        stability="deprecated"
        version="0.150.0"
        signals={[]}
        hrefRepository={null}
        hrefDocs={null}
      />
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
