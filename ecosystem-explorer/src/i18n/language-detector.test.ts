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
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { languageDetector } from "@/i18n/language-detector";

const STORAGE_KEY = "i18nextLng";

/** detect() is optional on i18next's detector interface, so narrow it once. */
function detect(): string[] {
  return languageDetector.detect() as string[];
}

function setQueryString(search: string) {
  window.history.replaceState({}, "", search === "" ? "/" : `/?${search}`);
}

function setNavigatorLanguages(languages: string[]) {
  vi.spyOn(window.navigator, "languages", "get").mockReturnValue(languages);
}

/** jsdom reports navigator.language as "en-US", so both navigator sources need silencing to isolate the others. */
function silenceNavigator() {
  setNavigatorLanguages([]);
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("");
}

beforeEach(() => {
  setQueryString("");
  window.localStorage.clear();
  silenceNavigator();
});

afterEach(() => {
  vi.restoreAllMocks();
  setQueryString("");
  window.localStorage.clear();
});

describe("languageDetector.detect", () => {
  it("returns candidates in priority order: query string, storage, then navigator", () => {
    setQueryString("lng=de");
    window.localStorage.setItem(STORAGE_KEY, "es");
    setNavigatorLanguages(["fr-FR", "fr"]);

    expect(detect()).toEqual(["de", "es", "fr-FR", "fr"]);
  });

  it("falls back to the stored language when no query string is present", () => {
    window.localStorage.setItem(STORAGE_KEY, "es");

    expect(detect()).toEqual(["es"]);
  });

  it("offers the full navigator preference list so i18next can match a region tag to a base language", () => {
    setNavigatorLanguages(["en-GB", "en"]);

    expect(detect()).toEqual(["en-GB", "en"]);
  });

  it("uses navigator.language when navigator.languages is empty", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-419");

    expect(detect()).toEqual(["es-419"]);
  });

  it("drops candidates that are not shaped like language tags", () => {
    setQueryString("lng=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    window.localStorage.setItem(STORAGE_KEY, "../../etc/passwd");
    setNavigatorLanguages(["en"]);

    expect(detect()).toEqual(["en"]);
  });

  it("returns an empty list when nothing is detectable", () => {
    expect(detect()).toEqual([]);
  });

  it("survives localStorage access throwing, as in Safari private browsing", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("access denied");
    });
    setNavigatorLanguages(["es"]);

    expect(detect()).toEqual(["es"]);
  });
});

describe("languageDetector.cacheUserLanguage", () => {
  it("persists the choice under the key i18next-browser-languagedetector used", () => {
    languageDetector.cacheUserLanguage?.("es");

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("es");
  });

  it("does not persist cimode, which would strand the user in debug mode", () => {
    languageDetector.cacheUserLanguage?.("cimode");

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("survives localStorage writes throwing", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => languageDetector.cacheUserLanguage?.("es")).not.toThrow();
  });
});
