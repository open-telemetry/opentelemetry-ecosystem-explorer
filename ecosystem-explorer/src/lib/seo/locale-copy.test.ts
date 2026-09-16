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

import { describe, expect, it } from "vitest";
import collectorEn from "../../../public/locales/en/collector.json";
import homeEn from "../../../public/locales/en/home.json";
import javaAgentEn from "../../../public/locales/en/java-agent.json";
import { STATIC_ROUTE_META } from "./derive";

// The edge function and build scripts read STATIC_ROUTE_META; the SPA renders
// the same metadata through the locale files. English must stay identical so
// crawlers and the browser tab agree per URL.
const CASES: Array<[string, { title: string; description: string }]> = [
  ["/", homeEn.homeV1.seo],
  ["/collector", collectorEn.landingV1.seo],
  ["/java-agent", javaAgentEn.landingV1.seo],
];

describe("localised SEO copy", () => {
  it.each(CASES)("en copy for %s matches STATIC_ROUTE_META", (path, seo) => {
    expect(seo).toEqual({
      title: STATIC_ROUTE_META[path].title,
      description: STATIC_ROUTE_META[path].description,
    });
  });
});
