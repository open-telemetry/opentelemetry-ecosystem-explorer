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
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import { FaCheck } from "@/v1/components/icons/fa-icon-check";
import { FaGlobe } from "@/v1/components/icons/fa-icon-globe";
import { LANGUAGES } from "@/i18n/languages";

/*
 * Language dropdown for the v1 navbar, structured like ThemeToggle (Radix
 * DropdownMenu + `td-*` chrome in `src/v1/styles/language-toggle.css`).
 *
 * Mirrors Docsy's `.td-lang-menu` on opentelemetry.io: globe glyph + the
 * active locale's endonym on the trigger (language code below `lg`), a
 * start-aligned menu, and a check on the active row. Rows list every entry in
 * LANGUAGES. Option labels are endonyms ("English", "Español"), so they read
 * the same in any locale and stay out of the translation files. The rest of
 * the v1 chrome (Docs link, theme labels) is still English-only — wiring it
 * through i18next is a separate pass.
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? "en";
  const activeLabel = LANGUAGES.find((language) => language.code === current)?.label ?? "English";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="td-lang-menu__trigger"
        aria-label={`Select language (${activeLabel})`}
      >
        <FaGlobe className="td-lang-menu__globe" />
        <span className="td-lang-menu__label">{activeLabel}</span>
        <span className="td-lang-menu__code">{current.toUpperCase()}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        {/* Bootstrap dropdown popper offset: [0, 2] */}
        <DropdownMenu.Content align="start" sideOffset={2} className="td-lang-menu__menu">
          {/* Radio semantics expose the active locale as `aria-checked`, not just the glyph. */}
          <DropdownMenu.RadioGroup
            value={current}
            onValueChange={(code) => i18n.changeLanguage(code)}
          >
            {LANGUAGES.map(({ code, label }) => (
              <DropdownMenu.RadioItem key={code} value={code} className="td-lang-menu__item">
                <DropdownMenu.ItemIndicator>
                  <FaCheck className="td-lang-menu__check" />
                </DropdownMenu.ItemIndicator>
                <span>{label}</span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
