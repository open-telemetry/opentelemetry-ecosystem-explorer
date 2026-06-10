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
import { describe, expect, it } from "vitest";
import { ReleaseCard } from "./release-card";

describe("ReleaseCard", () => {
  it("renders the version, date, and all three delta counters", () => {
    render(
      <ReleaseCard
        version="v0.150.0"
        releaseDate="May 2026"
        deltas={{ added: 4, changed: 12, deprecated: 2 }}
        hrefChangelog="https://example.com/changelog"
      />
    );
    expect(screen.getByText("v0.150.0")).toBeInTheDocument();
    expect(screen.getByText("May 2026")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View changelog/i })).toHaveAttribute(
      "href",
      "https://example.com/changelog"
    );
  });

  it("renders an empty state when no version is provided", () => {
    render(<ReleaseCard version={null} />);
    expect(screen.getByText(/Release information is not yet available/i)).toBeInTheDocument();
  });
});
