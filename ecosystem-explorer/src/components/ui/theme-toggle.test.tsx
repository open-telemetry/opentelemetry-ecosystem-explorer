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
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ThemeProvider } from "@/theme-context";
import { ThemeToggle } from "./theme-toggle";

function setup() {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
}

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    setup();
    vi.unstubAllGlobals();
  });

  it("starts in auto mode and shows the Monitor icon aria-label", () => {
    setup();
    renderToggle();
    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
  });

  it("cycles auto → light → dark → auto on successive clicks", async () => {
    setup();
    renderToggle();
    const user = userEvent.setup();
    const btn = screen.getByRole("button");

    // auto → light
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-label", "Switch to dark theme");

    // light → dark
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-label", "Switch to system theme");

    // dark → auto
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-label", "Switch to light theme");
  });

  it("updates data-theme on click", async () => {
    setup();
    renderToggle();
    const user = userEvent.setup();

    // auto (prefers-dark mocked as true) → resolved=dark; click → light
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
