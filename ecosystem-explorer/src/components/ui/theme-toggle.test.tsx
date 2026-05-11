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
import { describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider } from "@/theme-context";
import { ThemeToggle } from "./theme-toggle";

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders an auto-mode trigger labelled for accessibility", () => {
    renderToggle();
    expect(screen.getByRole("button", { name: /toggle theme \(auto\)/i })).toBeInTheDocument();
  });

  it("opens a menu with Light, Dark, and Auto options", async () => {
    renderToggle();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(await screen.findByRole("menuitem", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /auto/i })).toBeInTheDocument();
  });

  it("selecting Light applies data-theme=light and updates the trigger label", async () => {
    renderToggle();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    await user.click(await screen.findByRole("menuitem", { name: /light/i }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: /toggle theme \(light\)/i })).toBeInTheDocument();
  });

  it("selecting Dark applies data-theme=dark", async () => {
    renderToggle();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    await user.click(await screen.findByRole("menuitem", { name: /dark/i }));

    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
