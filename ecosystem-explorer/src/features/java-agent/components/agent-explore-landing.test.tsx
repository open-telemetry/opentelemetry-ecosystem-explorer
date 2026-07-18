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
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AgentExploreLanding } from "./agent-explore-landing";

describe("AgentExploreLanding", () => {
  it("renders the Configuration Builder card linking to the builder route", () => {
    render(
      <BrowserRouter>
        <AgentExploreLanding />
      </BrowserRouter>
    );
    const link = screen.getByRole("link", { name: /configuration builder/i });
    expect(link).toHaveAttribute("href", "/java-agent/configuration/builder");
  });

  it("renders the resources and documentation links", () => {
    render(
      <BrowserRouter>
        <AgentExploreLanding />
      </BrowserRouter>
    );

    expect(screen.getByRole("heading", { name: /resources & documentation/i })).toBeInTheDocument();

    const gettingStartedLink = screen.getByRole("link", {
      name: /java agent getting started/i,
    });
    expect(gettingStartedLink).toHaveAttribute(
      "href",
      "https://opentelemetry.io/docs/zero-code/java/"
    );

    const configRefLink = screen.getByRole("link", {
      name: /java agent configuration reference/i,
    });
    expect(configRefLink).toHaveAttribute(
      "href",
      "https://opentelemetry.io/docs/zero-code/java/agent/configuration/"
    );

    const githubLink = screen.getByRole("link", {
      name: /github repository/i,
    });
    expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/open-telemetry/opentelemetry-java-instrumentation"
    );
  });
});
