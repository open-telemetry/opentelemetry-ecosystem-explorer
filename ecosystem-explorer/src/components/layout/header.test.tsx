import { render, screen } from "@testing-library/react";
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
});
