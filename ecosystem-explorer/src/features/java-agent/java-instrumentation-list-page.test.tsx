import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { JavaInstrumentationListPage } from "@/features/java-agent/java-instrumentation-list-page";

describe("JavaInstrumentationListPage", () => {
  it("renders the page title", () => {
    render(
      <BrowserRouter>
        <JavaInstrumentationListPage />
      </BrowserRouter>
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("OpenTelemetry Java Agent Instrumentation");
  });

  it("renders the coming soon placeholder", () => {
    render(
      <BrowserRouter>
        <JavaInstrumentationListPage />
      </BrowserRouter>
    );
    expect(screen.getByText("Coming Soon...")).toBeInTheDocument();
  });

  it("renders a back button", () => {
    render(
      <BrowserRouter>
        <JavaInstrumentationListPage />
      </BrowserRouter>
    );
    const backButton = screen.getByRole("button", { name: /back/i });
    expect(backButton).toBeInTheDocument();
  });
});
