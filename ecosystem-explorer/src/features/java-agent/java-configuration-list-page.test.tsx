import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { JavaConfigurationListPage } from "@/features/java-agent/java-configuration-list-page";

describe("JavaConfigurationListPage", () => {
  it("renders the page title", () => {
    render(
      <BrowserRouter>
        <JavaConfigurationListPage />
      </BrowserRouter>
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("OpenTelemetry Java Agent Configuration");
  });

  it("renders the coming soon placeholder", () => {
    render(
      <BrowserRouter>
        <JavaConfigurationListPage />
      </BrowserRouter>
    );
    expect(screen.getByText("Coming Soon...")).toBeInTheDocument();
  });

  it("renders a back button", () => {
    render(
      <BrowserRouter>
        <JavaConfigurationListPage />
      </BrowserRouter>
    );
    const backButton = screen.getByRole("button", { name: /back/i });
    expect(backButton).toBeInTheDocument();
  });
});
