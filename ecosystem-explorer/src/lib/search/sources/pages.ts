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

import type { SearchResult, SearchSource } from "../types";

/** The app's own navigational surface — top-level pages and key sections. */
const PAGE_SEARCH_RESULTS: SearchResult[] = [
  {
    title: "Home",
    description: "Explore the OpenTelemetry ecosystem catalog",
    path: "/",
    type: "page",
    ecosystem: "page",
  },
  {
    title: "Java Agent",
    description: "Explore OpenTelemetry Java auto-instrumentation",
    path: "/java-agent",
    type: "page",
    ecosystem: "page",
  },
  {
    title: "Java Instrumentations",
    description: "Browse supported Java libraries and instrumentations",
    path: "/java-agent/instrumentation",
    type: "section",
    ecosystem: "page",
  },
  {
    title: "Java Configurations",
    description: "Configure OpenTelemetry Java Agent behavior",
    path: "/java-agent/configuration",
    type: "section",
    ecosystem: "page",
  },
  {
    title: "Java Release Comparison",
    description: "Compare features across Java Agent releases",
    path: "/java-agent/releases",
    type: "section",
    ecosystem: "page",
  },
  {
    title: "Configuration Builder",
    description: "Build custom OpenTelemetry configurations",
    path: "/java-agent/configuration/builder",
    type: "section",
    ecosystem: "page",
  },
  {
    title: "Collector",
    description: "Explore OpenTelemetry Collector components",
    path: "/collector",
    type: "page",
    ecosystem: "page",
  },
  {
    title: "About",
    description: "Learn about OpenTelemetry Ecosystem Explorer",
    path: "/about",
    type: "page",
    ecosystem: "page",
  },
];

export const pageSearchSource: SearchSource = {
  id: "page",
  // Static and synchronous; wrapped in a resolved promise so the page surface
  // composes through the same SearchSource contract as the data-backed
  // ecosystems. It never rejects, so pages always contribute to the index.
  load: () => Promise.resolve(PAGE_SEARCH_RESULTS),
};
