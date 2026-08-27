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
 * Minimal replacement for i18next-http-backend: the app only ever needs one GET
 * per (language, namespace) from the static public/locales tree.
 */
import type { BackendModule, ReadCallback, ResourceKey } from "i18next";

const LOAD_PATH = "/locales/{{lng}}/{{ns}}.json";

/**
 * `language` is user-controlled (the `?lng=` query parameter, or a localStorage
 * value written by an earlier visit), so percent-encoding is what keeps a value
 * like `../../secret` from escaping the locales directory.
 */
function buildUrl(language: string, namespace: string): string {
  return LOAD_PATH.replace("{{lng}}", encodeURIComponent(language)).replace(
    "{{ns}}",
    encodeURIComponent(namespace)
  );
}

/**
 * The second callback argument is i18next's retry flag. Set it only for failures
 * a later attempt could plausibly resolve — network errors and 5xx. A 4xx means
 * the file is absent and a parse failure means it is malformed; retrying either
 * just burns requests.
 */
async function loadResource(url: string, callback: ReadCallback): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    // A thrown value is only conventionally an Error; i18next logs `.message`.
    callback(error instanceof Error ? error : new Error(String(error)), true);
    return;
  }

  if (!response.ok) {
    const retry = response.status >= 500;
    callback(new Error(`failed loading ${url}; status code: ${response.status}`), retry);
    return;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    callback(new Error(`failed parsing ${url} to JSON`), false);
    return;
  }

  callback(null, data as ResourceKey);
}

export const httpBackend: BackendModule = {
  type: "backend",

  // Required by the interface; this backend takes no options.
  init() {},

  read(language, namespace, callback) {
    void loadResource(buildUrl(language, namespace), callback);
  },
};
