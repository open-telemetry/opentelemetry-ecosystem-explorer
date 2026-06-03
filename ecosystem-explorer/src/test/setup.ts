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
import "@testing-library/jest-dom";
import { beforeAll, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import commonEn from "../../public/locales/en/common.json";
import layoutEn from "../../public/locales/en/layout.json";
import homeEn from "../../public/locales/en/home.json";

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  ns: ["common", "layout", "home"],
  defaultNS: "common",
  resources: {
    en: {
      common: commonEn,
      layout: layoutEn,
      home: homeEn,
    },
  },
});

/*
 * jsdom doesn't ship `window.matchMedia`, but `ThemeProvider` calls it on
 * mount (via `useSyncExternalStore`) to resolve `auto` mode. Provide a stub
 * globally so tests that render anything under the provider don't have to
 * wire it up themselves. `matches: true` defaults to "system prefers dark".
 *
 * beforeAll is correct here: the stub is a constant value that never needs
 * resetting between tests in the same file.
 */
beforeAll(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

class ResizeObserverMock {
  constructor() {}

  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
HTMLElement.prototype.scrollIntoView = vi.fn();
HTMLElement.prototype.hasPointerCapture = vi.fn();
HTMLElement.prototype.releasePointerCapture = vi.fn();
