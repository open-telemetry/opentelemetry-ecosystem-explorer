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

import { SignalsRow } from "./signals-row";

const SIGNAL_LINK_NAMES: readonly { display: string; pattern: RegExp }[] = [
  { display: "Traces", pattern: /Traces/i },
  { display: "Metrics", pattern: /Metrics/i },
  { display: "Logs", pattern: /Logs/i },
  { display: "Baggage", pattern: /Baggage/i },
];

function renderRow() {
  return render(
    <MemoryRouter>
      <SignalsRow />
    </MemoryRouter>
  );
}

describe("SignalsRow", () => {
  it("labels the section via aria-labelledby pointing at the heading", () => {
    renderRow();
    const section = screen.getByRole("region", { name: "Browse by signal" });
    expect(section).toHaveAttribute("aria-labelledby", "signals-row-title");
    expect(screen.getByRole("heading", { level: 2, name: "Browse by signal" })).toHaveAttribute(
      "id",
      "signals-row-title"
    );
  });

  it("renders the four canonical OpenTelemetry signals (Traces / Metrics / Logs / Baggage)", () => {
    renderRow();
    for (const { pattern } of SIGNAL_LINK_NAMES) {
      expect(screen.getByRole("link", { name: pattern })).toBeInTheDocument();
    }
  });

  it("uses Baggage instead of Profiles (matches opentelemetry.io taxonomy)", () => {
    renderRow();
    expect(screen.getByText("Baggage")).toBeInTheDocument();
    expect(screen.queryByText(/profiles/i)).toBeNull();
  });

  it("links each signal internally to /collector/components?signal=<id>", () => {
    renderRow();
    expect(screen.getByRole("link", { name: /Traces/ })).toHaveAttribute(
      "href",
      "/collector/components?signal=traces"
    );
    expect(screen.getByRole("link", { name: /Metrics/ })).toHaveAttribute(
      "href",
      "/collector/components?signal=metrics"
    );
    expect(screen.getByRole("link", { name: /Logs/ })).toHaveAttribute(
      "href",
      "/collector/components?signal=logs"
    );
    expect(screen.getByRole("link", { name: /Baggage/ })).toHaveAttribute(
      "href",
      "/collector/components?signal=baggage"
    );
  });
});
