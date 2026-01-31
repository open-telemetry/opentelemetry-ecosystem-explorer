import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CollectorPage } from "@/features/collector/collector-page.tsx";

describe("CollectorPage", () => {
  it("renders the page title", () => {
    render(<CollectorPage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("OpenTelemetry Collector");
  });
});
