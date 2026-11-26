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
import * as javascriptData from "@/lib/api/javascript-data";
import { createPackageIndexHooks } from "./use-package-index-data";

const hooks = createPackageIndexHooks<JavascriptIndex, JavascriptPackage>({
  loadIndex: () => javascriptData.loadIndex(),
  loadPackage: (name, version) => javascriptData.loadPackage(name, version),
});

export const useJavascriptIndex = hooks.useIndex;

/** Loads one release of a package, or its latest release when `version` is omitted. */
export const useJavascriptPackage = hooks.usePackage;
