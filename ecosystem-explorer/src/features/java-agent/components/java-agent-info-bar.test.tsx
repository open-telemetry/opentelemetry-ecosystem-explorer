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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { JavaAgentInfoBar } from "./java-agent-info-bar";
import { useJavaAgentSummary } from "../hooks/use-java-agent-summary";

vi.mock("../hooks/use-java-agent-summary", () => ({
  useJavaAgentSummary: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("JavaAgentInfoBar", () => {
  it("renders loading skeletons when summary is loading", () => {
    vi.mocked(useJavaAgentSummary).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    const { container } = render(<JavaAgentInfoBar />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText("Available instrumentations")).not.toBeInTheDocument();
  });

  it("renders stats correctly when loaded successfully", () => {
    vi.mocked(useJavaAgentSummary).mockReturnValue({
      data: {
        latestVersion: "1.32.0",
        instrumentationCount: 247,
      },
      loading: false,
      error: null,
    });

    render(<JavaAgentInfoBar />);

    expect(screen.getByText("247")).toBeInTheDocument();
    expect(screen.getByText("v1.32.0")).toBeInTheDocument();
    expect(screen.getByText("Available instrumentations")).toBeInTheDocument();
    expect(screen.getByText("Latest release version")).toBeInTheDocument();
  });

  it("renders error alert when loading fails", () => {
    vi.mocked(useJavaAgentSummary).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Network fetch failed"),
    });

    render(<JavaAgentInfoBar />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/Failed to load summary stats: Network fetch failed/i)
    ).toBeInTheDocument();
  });
});
