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
import { describe, it, expect } from "vitest";
import { Loader } from "@/components/ui/loader";

describe("Loader Component", () => {
  it("renders the large loader (lg) by default with accessibility attributes", () => {
    const { container } = render(<Loader />);

    const loaderContainer = screen.getByRole("status");
    expect(loaderContainer).toBeInTheDocument();
    expect(loaderContainer).toHaveAttribute("aria-live", "polite");
    expect(loaderContainer).toHaveAttribute("aria-busy", "true");

    // Large loader container classes
    expect(loaderContainer).toHaveClass("flex", "min-h-[400px]", "flex-col", "items-center");

    // Check spin icon
    const svgIcon = container.querySelector(".animate-spin");
    expect(svgIcon).toBeInTheDocument();
    expect(svgIcon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders large loader (lg) with a custom label and standard subtext", () => {
    render(<Loader label="Fetching data..." />);

    expect(screen.getByText("Fetching data...")).toBeInTheDocument();
    expect(screen.getByText("This may take a moment")).toBeInTheDocument();
  });

  it("renders the small loader (sm) when specified", () => {
    const { container } = render(<Loader size="sm" />);

    const loaderContainer = screen.getByRole("status");
    expect(loaderContainer).toBeInTheDocument();
    expect(loaderContainer).toHaveAttribute("aria-live", "polite");
    expect(loaderContainer).toHaveAttribute("aria-busy", "true");

    // Small loader container classes
    expect(loaderContainer).toHaveClass("flex", "items-center", "gap-3", "py-2");

    const svgIcon = container.querySelector(".animate-spin");
    expect(svgIcon).toBeInTheDocument();
    expect(svgIcon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders small loader (sm) with a custom label and no subtext", () => {
    render(<Loader size="sm" label="Updating..." />);

    expect(screen.getByText("Updating...")).toBeInTheDocument();
    expect(screen.queryByText("This may take a moment")).not.toBeInTheDocument();
  });

  it("applies additional CSS classes when className is provided", () => {
    render(<Loader className="custom-test-class" />);

    const loaderContainer = screen.getByRole("status");
    expect(loaderContainer).toHaveClass("custom-test-class");
  });
});
