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

export interface SearchResult {
  title: string;
  description: string;
  path: string;
  type: "page" | "section";
}

// Define searchable content in the app
const searchableContent: SearchResult[] = [
  {
    title: "Java Agent",
    description: "Explore OpenTelemetry Java auto-instrumentation",
    path: "/java-agent",
    type: "page",
  },
  {
    title: "Java Instrumentations",
    description: "Browse supported Java libraries and instrumentations",
    path: "/java-agent/instrumentations",
    type: "section",
  },
  {
    title: "Java Configurations",
    description: "Configure OpenTelemetry Java Agent behavior",
    path: "/java-agent/configurations",
    type: "section",
  },
  {
    title: "Java Release Comparison",
    description: "Compare features across Java Agent releases",
    path: "/java-agent/release-comparison",
    type: "section",
  },
  {
    title: "Collector",
    description: "Explore OpenTelemetry Collector components",
    path: "/collector",
    type: "page",
  },
  {
    title: "Configuration Builder",
    description: "Build custom OpenTelemetry configurations",
    path: "/java-agent/config-builder",
    type: "section",
  },
  {
    title: "About",
    description: "Learn about OpenTelemetry Ecosystem Explorer",
    path: "/about",
    type: "page",
  },
];

/**
 * Search through available content
 * @param query Search query string
 * @returns Array of matching search results
 */
export function search(query: string): SearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();

  return searchableContent
    .filter((item) => {
      const matchesTitle = item.title.toLowerCase().includes(lowerQuery);
      const matchesDescription = item.description.toLowerCase().includes(lowerQuery);
      return matchesTitle || matchesDescription;
    })
    .sort((a, b) => {
      // Prioritize title matches over description matches
      const aTitle = a.title.toLowerCase().includes(lowerQuery);
      const bTitle = b.title.toLowerCase().includes(lowerQuery);
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;
      return a.title.localeCompare(b.title);
    });
}
