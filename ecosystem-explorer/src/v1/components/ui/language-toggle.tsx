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
import { BsTranslate } from "@/v1/components/icons/bs-icon-translate";
import { LANGUAGES } from "@/i18n/languages";

/*
 * Language dropdown for the v1 navbar, structured like ThemeToggle (Radix
 * DropdownMenu + `td-*` chrome in `src/v1/styles/language-toggle.css`).
 *
 * The trigger shows the active locale's endonym; rows list every entry in
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
        <BsTranslate />
        <span className="td-lang-menu__current">{activeLabel}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="td-lang-menu__menu">
          {LANGUAGES.map(({ code, label }) => (
            <DropdownMenu.Item
              key={code}
              className="td-lang-menu__item"
              data-active={code === current}
              onSelect={() => i18n.changeLanguage(code)}
            >
              <span>{label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
