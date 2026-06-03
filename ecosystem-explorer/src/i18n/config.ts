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
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { isEnabled } from "@/lib/feature-flags";

const i18nInstance = i18n.use(HttpBackend);

// Only wire up language detection when the i18n feature flag is on.
// Without it, the detector might restore a previously saved non-English locale
// from localStorage even though the switcher UI is hidden.
if (isEnabled("I18N")) {
  i18nInstance.use(LanguageDetector);
}

i18nInstance.use(initReactI18next).init({
  ...(isEnabled("I18N") ? {} : { lng: "en" }),
  fallbackLng: "en",
  ns: ["common", "layout", "home", "collector", "java-agent", "about"],
  defaultNS: "common",
  backend: { loadPath: "/locales/{{lng}}/{{ns}}.json" },
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
