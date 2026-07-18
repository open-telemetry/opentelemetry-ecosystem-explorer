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

// Must be imported before any module that calls isIDBAvailable(), since
// javaagent-data.ts evaluates `const idbEnabled = isIDBAvailable()` at
// module load time.
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";
import { clearAllCached, closeDB } from "@/lib/api/idb-cache";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import commonEn from "../../../public/locales/en/common.json";
import layoutEn from "../../../public/locales/en/layout.json";
import homeEn from "../../../public/locales/en/home.json";
import collectorEn from "../../../public/locales/en/collector.json";
import javaAgentEn from "../../../public/locales/en/java-agent.json";
import aboutEn from "../../../public/locales/en/about.json";
import listEn from "../../../public/locales/en/list.json";

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  ns: ["common", "layout", "home", "collector", "java-agent", "about", "list"],
  defaultNS: "common",
  resources: {
    en: {
      common: commonEn,
      layout: layoutEn,
      home: homeEn,
      collector: collectorEn,
      "java-agent": javaAgentEn,
      about: aboutEn,
      list: listEn,
    },
  },
});

// JSDOM does not implement Element.scrollIntoView or scrollBy; stub them
// unconditionally (matching src/test/setup.ts) so that click handlers wired to
// scrollToSection don't throw, and so tests can assert against them as vi mocks
// even if a future JSDOM/polyfill provides a real implementation.
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollBy = vi.fn();
}

beforeEach(async () => {
  if (typeof Element !== "undefined" && vi.isMockFunction(Element.prototype.scrollIntoView)) {
    // @ts-expect-error mockClear is not in type definitions for Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView.mockClear();
  }
  if (typeof Element !== "undefined" && vi.isMockFunction(Element.prototype.scrollBy)) {
    // @ts-expect-error mockClear is not in type definitions for Element.prototype.scrollBy
    Element.prototype.scrollBy.mockClear();
  }
  // Clear stored entries so each test starts with a cold cache.
  await clearAllCached();
  // Reset the IDB singleton (dbInstance, dbInitPromise, dbInitFailed) so
  // the next initDB() call opens a fresh connection.
  closeDB();
});
