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
 * Minimal replacement for i18next-browser-languagedetector, keeping only the
 * three detection sources the app uses (querystring, localStorage, navigator).
 * The dropped ones — cookie, sessionStorage, path, subdomain, hash — have no
 * counterpart here, and htmlTag can only ever echo back `fallbackLng` because
 * config.ts rewrites that attribute on every languageChanged.
 */
import type { LanguageDetectorModule } from "i18next";

/** Upstream's `lookupLocalStorage` default; changing it would reset every existing visitor's language. */
const STORAGE_KEY = "i18nextLng";

const QUERY_PARAM = "lng";

/** i18next's key-debugging pseudo-language; persisting it would strand the user in debug mode. */
const NEVER_CACHED = ["cimode"];

/**
 * Loose BCP-47 shape, used to keep obvious junk out of the untrusted candidates
 * (query string, localStorage). i18next's `supportedLngs` is the real gate on
 * which languages actually activate.
 */
const LANGUAGE_TAG = /^[a-z]{2,8}(-[a-z0-9]{1,8})*$/i;

function fromQueryString(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get(QUERY_PARAM) ?? undefined;
}

/** Reading localStorage throws (not returns null) when storage is disabled, e.g. Safari private browsing. */
function fromLocalStorage(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function fromNavigator(): string[] {
  if (typeof navigator === "undefined") return [];
  if (navigator.languages?.length) return [...navigator.languages];
  return navigator.language ? [navigator.language] : [];
}

export const languageDetector: LanguageDetectorModule = {
  type: "languageDetector",

  /*
   * Returns all candidates in priority order, not a single language: i18next
   * resolves the list against `supportedLngs` and `load`, which is what lets a
   * browser advertising `en-GB` match the `en` bundle.
   */
  detect(): string[] {
    return [fromQueryString(), fromLocalStorage(), ...fromNavigator()].filter(
      (candidate): candidate is string => candidate !== undefined && LANGUAGE_TAG.test(candidate)
    );
  },

  cacheUserLanguage(language: string): void {
    if (NEVER_CACHED.includes(language)) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Persisting the choice is best-effort; the app still works for this session.
    }
  },
};
