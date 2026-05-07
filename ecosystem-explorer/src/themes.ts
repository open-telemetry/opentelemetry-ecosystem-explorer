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

/**
 * Theme metadata — typed canonical reference for the HSL triplets in tokens.css.
 *
 * Naming mirrors opentelemetry.io's _vars.scss:
 *   $primary   = blue  (228 37% 49%)
 *   $secondary = orange (41 100% 48%)
 *
 * JS does NOT inject these values at runtime; CSS owns them via [data-theme="..."] selectors
 * in src/styles/tokens.css. This file exists for type safety and as a single source of truth
 * that documents which values the CSS emits.
 */

export type ResolvedThemeId = "light" | "dark";

export interface Theme {
  id: ResolvedThemeId;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    card: string;
    cardSecondary: string;
    muted: string;
    mutedForeground: string;
    border: string;
    syntax: {
      comment: string;
      key: string;
      string: string;
      number: string;
      keyword: string;
      punct: string;
    };
  };
}

const dark: Theme = {
  id: "dark",
  name: "OTel Vibrant",
  description: "Default OpenTelemetry-aligned dark theme.",
  colors: {
    primary: "228 37% 49%",
    secondary: "41 100% 48%",
    background: "232 38% 15%",
    foreground: "210 17% 98%",
    card: "232 35% 19%",
    cardSecondary: "232 32% 23%",
    muted: "232 28% 22%",
    mutedForeground: "220 14% 65%",
    border: "232 22% 28%",
    syntax: {
      comment: "220 18% 58%",
      key: "28 95% 65%",
      string: "95 60% 65%",
      number: "330 80% 72%",
      keyword: "265 70% 78%",
      punct: "220 22% 55%",
    },
  },
};

const light: Theme = {
  id: "light",
  name: "OTel Light",
  description: "Light theme aligned with opentelemetry.io.",
  colors: {
    primary: "228 37% 49%",
    secondary: "41 100% 48%",
    background: "0 0% 100%",
    foreground: "220 13% 15%",
    card: "210 17% 98%",
    cardSecondary: "210 14% 95%",
    muted: "210 14% 92%",
    mutedForeground: "220 9% 40%",
    border: "210 14% 88%",
    syntax: {
      comment: "220 18% 58%",
      key: "28 95% 65%",
      string: "95 60% 65%",
      number: "330 80% 72%",
      keyword: "265 70% 78%",
      punct: "220 22% 55%",
    },
  },
};

export const themes: Record<ResolvedThemeId, Theme> = { light, dark };

export const DEFAULT_THEME: ResolvedThemeId = "dark";
