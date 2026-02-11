import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { BackButton } from "@/components/ui/back-button";

describe("BackButton", () => {
  it("renders with default label", () => {
    render(
      <BrowserRouter>
        <BackButton />
      </BrowserRouter>
    );
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    render(
      <BrowserRouter>
        <BackButton label="Go Back" />
      </BrowserRouter>
    );
    expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByText("Go Back")).toBeInTheDocument();
  });
});
