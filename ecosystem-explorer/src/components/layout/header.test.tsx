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
import { ThemeProvider } from "@/theme-context";
import { Header } from "./header";

describe("Header", () => {
  it("renders the app name", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("OTel Explorer")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
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
        <ThemeProvider>
          <Header />
        </ThemeProvider>
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
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>
    );

    const homeLink = screen.getByRole("link", { name: /otel explorer/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("shows hamburger button", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
  });

  it("toggles mobile menu open and closed", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
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
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("navigation", { name: /mobile main/i })).toBeInTheDocument();

    const javaAgentLink = screen
      .getAllByRole("link", { name: /java agent/i })
      .find((el) => el.closest("nav[aria-label='Mobile main']"));
    await user.click(javaAgentLink!);

    expect(screen.queryByRole("navigation", { name: /mobile main/i })).not.toBeInTheDocument();
  });

  it("closes mobile menu when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("navigation", { name: /mobile main/i })).toBeInTheDocument();

    await user.click(screen.getByTestId("mobile-nav-backdrop"));

    expect(screen.queryByRole("navigation", { name: /mobile main/i })).not.toBeInTheDocument();
  });

  it("opens theme menu and updates selected theme option", async () => {
    const user = userEvent.setup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");

    render(
      <MemoryRouter>
        <ThemeProvider>
          <Header />
        </ThemeProvider>
      </MemoryRouter>
    );

    // There should be two Toggle theme buttons (desktop and mobile)
    const toggleButtons = screen.getAllByRole("button", { name: /toggle theme/i });
    expect(toggleButtons.length).toBeGreaterThan(0);
    const trigger = toggleButtons[0];

    // Click the toggle button to open the dropdown
    await user.click(trigger);

    // Verify Light, Dark, Auto dropdown menu items are in document
    const lightOption = await screen.findByRole("menuitem", { name: /light/i });
    const darkOption = screen.getByRole("menuitem", { name: /dark/i });
    const autoOption = screen.getByRole("menuitem", { name: /auto/i });

    expect(lightOption).toBeInTheDocument();
    expect(darkOption).toBeInTheDocument();
    expect(autoOption).toBeInTheDocument();

    // Click light option
    await user.click(lightOption);

    // Assert that theme updates are persisted in localStorage and document dataset theme
    expect(localStorage.getItem("td-color-theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    // Click trigger again to switch to dark
    await user.click(trigger);
    const updatedDarkOption = await screen.findByRole("menuitem", { name: /dark/i });
    await user.click(updatedDarkOption);

    expect(localStorage.getItem("td-color-theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
