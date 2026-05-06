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
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { Header } from "./header";

describe("Header", () => {
  it("renders the app name", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByText("OTel Explorer")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const javaAgentLink = screen.getByRole("link", { name: /java agent/i });
    const collectorLink = screen.getByRole("link", { name: /collector/i });

    expect(javaAgentLink).toBeInTheDocument();
    expect(collectorLink).toBeInTheDocument();
  });

  it("navigation links point to correct routes", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const javaAgentLink = screen.getByRole("link", { name: /java agent/i });
    const collectorLink = screen.getByRole("link", { name: /collector/i });

    expect(javaAgentLink).toHaveAttribute("href", "/java-agent");
    expect(collectorLink).toHaveAttribute("href", "/collector");
  });

  it("renders the logo as a link to home", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const homeLink = screen.getByRole("link", { name: /otel explorer/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("shows hamburger button", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
  });

  it("toggles mobile menu open and closed", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const toggleButton = screen.getByRole("button", { name: /open menu/i });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    await user.click(toggleButton);

    expect(screen.getByRole("button", { name: /close menu/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("navigation", { name: /mobile main/i })).toBeInTheDocument();
  });

  it("closes mobile menu when a nav link is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("navigation", { name: /mobile main/i })).toBeInTheDocument();

    const javaAgentLink = screen.getAllByRole("link", { name: /java agent/i }).find(
      (el) => el.closest("nav[aria-label='Mobile main']")
    );
    await user.click(javaAgentLink!);

    expect(screen.queryByRole("navigation", { name: /mobile main/i })).not.toBeInTheDocument();
  });
});
