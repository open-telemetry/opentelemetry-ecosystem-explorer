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

/*
 * Single source of truth for the locales and namespaces the app ships.
 * This module is intentionally side-effect free (no i18n.init()), so UI and
 * tests can import the lists without pulling in the runtime backend.
 *
 * Adding a language: append an entry to LANGUAGES and drop the matching
 * public/locales/<code>/ files. The init config and the navbar switcher both
 * derive from here, so the supported set and the switcher options never drift.
 */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const SUPPORTED_LANGUAGES: LanguageCode[] = LANGUAGES.map((language) => language.code);

export const NAMESPACES = [
  "common",
  "layout",
  "home",
  "collector",
  "java-agent",
  "about",
  "ecosystem",
  "list",
] as const;
