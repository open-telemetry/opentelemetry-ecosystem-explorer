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
import { CncfCallout } from "./cncf-callout";

describe("CncfCallout", () => {
  it("renders the CNCF graduated-project statement", () => {
    render(<CncfCallout />);

    expect(screen.getByText(/OpenTelemetry is a/i)).toBeInTheDocument();
    expect(screen.getByText(/graduated project/i)).toBeInTheDocument();
    expect(
      screen.getByText(/merger of the OpenTracing and OpenCensus projects/i)
    ).toBeInTheDocument();
  });

  it('links "CNCF" to cncf.io and opens it in a new tab', () => {
    render(<CncfCallout />);

    const cncfLink = screen.getByRole("link", { name: "CNCF" });
    expect(cncfLink).toHaveAttribute("href", "https://cncf.io");
    expect(cncfLink).toHaveAttribute("target", "_blank");
    expect(cncfLink.getAttribute("rel")).toMatch(/\bnoopener\b/);
  });

  it("renders the CNCF wordmark with an accessible name", () => {
    render(<CncfCallout />);

    expect(
      screen.getByRole("img", { name: /Cloud Native Computing Foundation/i })
    ).toBeInTheDocument();
  });

  it("exposes the callout as a labelled region", () => {
    render(<CncfCallout />);

    expect(
      screen.getByRole("region", { name: /OpenTelemetry is a.*graduated project/i })
    ).toBeInTheDocument();
  });
});
