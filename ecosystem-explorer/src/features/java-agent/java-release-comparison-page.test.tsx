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

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { JavaReleaseComparisonPage } from "./java-release-comparison-page";

vi.mock("@/hooks/use-javaagent-data", () => ({
  useVersions: () => ({ data: null, loading: true, error: null }),
}));

vi.mock("@/features/java-agent/hooks/use-release-diff", () => ({
  useReleaseDiff: () => ({ diffs: [], summary: null, loading: false, error: null }),
}));

describe("JavaReleaseComparisonPage", () => {
  it("renders the page heading", () => {
    render(
      <BrowserRouter>
        <JavaReleaseComparisonPage />
      </BrowserRouter>
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Release Comparison");
  });

  it("shows the versions loading indicator while versions are loading", () => {
    render(
      <BrowserRouter>
        <JavaReleaseComparisonPage />
      </BrowserRouter>
    );
    expect(screen.getByText(/loading versions/i)).toBeInTheDocument();
  });
});
