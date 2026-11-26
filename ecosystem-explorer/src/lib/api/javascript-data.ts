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

import type { JavascriptIndex, JavascriptPackage } from "@/types/javascript";
import { createPackageIndexLoaders } from "./package-index-data";

const loaders = createPackageIndexLoaders<JavascriptIndex, JavascriptPackage>(
  "javascript",
  "JavaScript"
);

/**
 * Loads `index.json`: every package, its latest metadata and its releases.
 *
 * It is the only manifest for this ecosystem (there is no versions index), so a
 * response without a packages list is rejected rather than cached.
 */
export const loadIndex = loaders.loadIndex;

/**
 * Loads one release of a package, or its latest release when `version` is omitted.
 *
 * The release is resolved through `index.json` to its content-addressed package
 * file, which is cached without expiry. See `createPackageIndexLoaders`.
 *
 * @param index Optional pre-loaded index, so a page that already holds it does not
 *   look it up again.
 */
export const loadPackage = loaders.loadPackage;
