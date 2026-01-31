import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { JavaAgentPage } from "@/features/java-agent/java-agent-page.tsx";

describe("JavaAgentPage", () => {
  it("renders the page title", () => {
    render(<JavaAgentPage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("OpenTelemetry Java Agent");
  });
});
