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
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { NavigationCard } from "./navigation-card";

describe("NavigationCard", () => {
  const mockIcon = <svg data-testid="test-icon" />;

  it("renders title and description", () => {
    render(
      <MemoryRouter>
        <NavigationCard
          title="Test Title"
          description="Test description text"
          href="/test"
          icon={mockIcon}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test description text")).toBeInTheDocument();
  });

  it("renders the provided icon", () => {
    render(
      <MemoryRouter>
        <NavigationCard
          title="Test Title"
          description="Test description"
          href="/test"
          icon={mockIcon}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("links to the correct href", () => {
    render(
      <MemoryRouter>
        <NavigationCard
          title="Test Title"
          description="Test description"
          href="/test-path"
          icon={mockIcon}
        />
      </MemoryRouter>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/test-path");
  });
});
