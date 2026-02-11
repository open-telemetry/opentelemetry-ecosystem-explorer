import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { AgentExploreLanding } from "@/features/java-agent/components/agent-explore-landing";

describe("AgentExploreLanding", () => {
  it("renders navigation cards for instrumentation and configuration", () => {
    render(
      <BrowserRouter>
        <AgentExploreLanding />
      </BrowserRouter>
    );

    expect(screen.getByText("Instrumentation Libraries")).toBeInTheDocument();
    expect(screen.getByText("Configuration Options")).toBeInTheDocument();
  });

  it("has correct links for navigation cards", () => {
    render(
      <BrowserRouter>
        <AgentExploreLanding />
      </BrowserRouter>
    );

    const links = screen.getAllByRole("link");
    const instrumentationLink = links.find(
      (link) => link.getAttribute("href") === "/java-agent/instrumentation"
    );
    const configurationLink = links.find(
      (link) => link.getAttribute("href") === "/java-agent/configuration"
    );

    expect(instrumentationLink).toBeDefined();
    expect(configurationLink).toBeDefined();
  });
});
