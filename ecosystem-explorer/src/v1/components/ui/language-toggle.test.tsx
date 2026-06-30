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
import i18n from "i18next";
import { LanguageToggle } from "./language-toggle";

describe("LanguageToggle", () => {
  // The test i18n instance is a shared singleton; reset to English so each
  // case starts from a known active locale regardless of run order.
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders an accessible trigger showing the active locale", () => {
    render(<LanguageToggle />);

    const trigger = screen.getByRole("button", { name: /select language/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("English");
  });

  it("opens a menu listing the supported locales", async () => {
    render(<LanguageToggle />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /select language/i }));

    expect(await screen.findByRole("menuitem", { name: /english/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /español/i })).toBeInTheDocument();
  });

  it("requests a language change when a locale is selected", async () => {
    // The test i18n bundle only carries `en` resources, so `resolvedLanguage`
    // (and thus the trigger label) stays "en" after switching to a locale with
    // no loaded resources. Assert the observable behaviour instead: the
    // component asks i18next to switch, and `language` reflects the request.
    const changeLanguage = vi.spyOn(i18n, "changeLanguage");
    render(<LanguageToggle />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /select language/i }));
    await user.click(await screen.findByRole("menuitem", { name: /español/i }));

    expect(changeLanguage).toHaveBeenCalledWith("es");
    expect(i18n.language).toBe("es");

    changeLanguage.mockRestore();
  });
});
