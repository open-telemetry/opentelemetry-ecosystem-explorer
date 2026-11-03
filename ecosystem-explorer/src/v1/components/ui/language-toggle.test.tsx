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
import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import i18n from "i18next";
import { LanguageToggle } from "./language-toggle";
import commonEs from "../../../../public/locales/es/common.json";

describe("LanguageToggle", () => {
  // The test i18n instance is a shared singleton; reset to English so each
  // case starts from a known active locale regardless of run order.
  beforeEach(async () => {
    i18n.addResourceBundle("es", "common", commonEs);
    await i18n.changeLanguage("en");
  });

  it("renders an accessible trigger showing the active locale", () => {
    render(<LanguageToggle />);

    const trigger = screen.getByRole("button", { name: /select language/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("English");
    expect(trigger).toHaveAccessibleName("Select language (English, EN)");
  });

  it("opens a menu listing the supported locales", async () => {
    render(<LanguageToggle />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /select language/i }));

    const english = await screen.findByRole("menuitemradio", { name: /english/i });
    const spanish = screen.getByRole("menuitemradio", { name: /español/i });
    expect(english).toBeInTheDocument();
    expect(spanish).toBeInTheDocument();
    // The active locale is announced as checked and carries the check glyph,
    // like upstream's `.dropdown-item.active`.
    expect(english).toHaveAttribute("aria-checked", "true");
    expect(spanish).toHaveAttribute("aria-checked", "false");
    expect(english.querySelector(".td-lang-menu__check")).not.toBeNull();
    expect(spanish.querySelector(".td-lang-menu__check")).toBeNull();
  });

  it("requests a language change when a locale is selected", async () => {
    const changeLanguage = vi.spyOn(i18n, "changeLanguage");
    render(<LanguageToggle />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /select language/i }));
    await user.click(await screen.findByRole("menuitemradio", { name: /español/i }));

    expect(changeLanguage).toHaveBeenCalledWith("es");
    expect(i18n.language).toBe("es");
    expect(screen.getByRole("button", { name: /select language/i })).toHaveAccessibleName(
      "Select language (Español, ES)"
    );

    changeLanguage.mockRestore();
  });
});
