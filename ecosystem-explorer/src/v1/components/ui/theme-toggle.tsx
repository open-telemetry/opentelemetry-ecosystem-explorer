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
import { type JSX } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { BsCircleHalf } from "@/v1/components/icons/bs-icon-circle-half";
import { BsSunFill } from "@/v1/components/icons/bs-icon-sun-fill";
import { BsMoonStarsFill } from "@/v1/components/icons/bs-icon-moon-stars-fill";
import { type ThemeMode, useTheme } from "@/theme-context";

/*
 * Three-option dropdown mirroring opentelemetry.io's
 * `themes/docsy/layouts/_partials/theme-toggler.html`:
 *   - trigger button shows the icon for the *current* mode
 *   - menu rows are Light / Dark / Auto with Bootstrap-Icons glyphs
 *   - active row is signalled by background colour only (no checkmark) —
 *     upstream renders a `check2` SVG but always `d-none`-hides it.
 * Visuals live in `src/v1/styles/theme-toggle.css`.
 */

type Option = {
  mode: ThemeMode;
  label: string;
  Icon: (props: { className?: string }) => JSX.Element;
};

const OPTIONS: ReadonlyArray<Option> = [
  { mode: "light", label: "Light", Icon: BsSunFill },
  { mode: "dark", label: "Dark", Icon: BsMoonStarsFill },
  { mode: "auto", label: "Auto", Icon: BsCircleHalf },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const ActiveIcon = OPTIONS.find((o) => o.mode === mode)?.Icon ?? BsCircleHalf;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="td-light-dark-menu__trigger"
        aria-label={`Toggle theme (${mode})`}
      >
        <ActiveIcon />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="td-light-dark-menu__menu">
          {OPTIONS.map(({ mode: optMode, label, Icon }) => (
            <DropdownMenu.Item
              key={optMode}
              className="td-light-dark-menu__item"
              data-active={mode === optMode}
              onSelect={() => setMode(optMode)}
            >
              <Icon />
              <span>{label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
