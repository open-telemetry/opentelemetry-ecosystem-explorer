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
import { describe, it, expect } from "vitest";
import { themes, DEFAULT_THEME } from "./themes";

const COLOR_KEYS = [
  "primary",
  "secondary",
  "background",
  "foreground",
  "card",
  "cardSecondary",
  "muted",
  "mutedForeground",
  "border",
] as const;

describe("themes", () => {
  it("exports both light and dark theme records", () => {
    expect(themes.light).toBeDefined();
    expect(themes.dark).toBeDefined();
  });

  it.each(["light", "dark"] as const)("%s theme has all required color keys non-empty", (id) => {
    const theme = themes[id];
    for (const key of COLOR_KEYS) {
      expect(theme.colors[key], `${id}.colors.${key}`).toBeTruthy();
    }
    expect(theme.colors.syntax.comment).toBeTruthy();
    expect(theme.colors.syntax.key).toBeTruthy();
  });

  it("DEFAULT_THEME is dark", () => {
    expect(DEFAULT_THEME).toBe("dark");
  });
});
