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
import { Monitor, Moon, Sun } from "lucide-react";
import { type ThemeMode, useTheme } from "@/theme-context";

const NEXT: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "auto", auto: "light" };

const LABEL: Record<ThemeMode, string> = {
  light: "Switch to dark theme",
  dark: "Switch to system theme",
  auto: "Switch to light theme",
};

const ICON = { light: Sun, dark: Moon, auto: Monitor } as const;

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const Icon = ICON[mode];

  return (
    <button
      type="button"
      aria-label={LABEL[mode]}
      onClick={() => setMode(NEXT[mode])}
      className="text-foreground/70 hover:bg-muted hover:text-foreground focus-visible:ring-primary flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Icon size={16} aria-hidden />
    </button>
  );
}
