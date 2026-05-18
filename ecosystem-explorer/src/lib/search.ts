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

import { loadAllComponents, loadVersions as loadCollectorVersions } from "@/lib/api/collector-data";
import { loadAllInstrumentations, loadVersions as loadJavaAgentVersions } from "@/lib/api/javaagent-data";
import type { CollectorComponent } from "@/types/collector";
import type { InstrumentationData } from "@/types/javaagent";

export interface SearchResult {
  title: string;
  description: string;
  path: string;
  type: "page" | "section" | "item";
  keywords?: string[];
}

const pageSearchResults: SearchResult[] = [
  {
    title: "Home",
    description: "Explore the OpenTelemetry ecosystem catalog",
    path: "/",
    type: "page",
  },
  {
    title: "Java Agent",
    description: "Explore OpenTelemetry Java auto-instrumentation",
    path: "/java-agent",
    type: "page",
  },
  {
    title: "Java Instrumentations",
    description: "Browse supported Java libraries and instrumentations",
    path: "/java-agent/instrumentation",
    type: "section",
  },
  {
    title: "Java Configurations",
    description: "Configure OpenTelemetry Java Agent behavior",
    path: "/java-agent/configuration",
    type: "section",
  },
  {
    title: "Java Release Comparison",
    description: "Compare features across Java Agent releases",
    path: "/java-agent/releases",
    type: "section",
  },
  {
    title: "Configuration Builder",
    description: "Build custom OpenTelemetry configurations",
    path: "/java-agent/configuration/builder",
    type: "section",
  },
  {
    title: "Collector",
    description: "Explore OpenTelemetry Collector components",
    path: "/collector",
    type: "page",
  },
  {
    title: "About",
    description: "Learn about OpenTelemetry Ecosystem Explorer",
    path: "/about",
    type: "page",
  },
];

let searchIndexPromise: Promise<SearchResult[]> | null = null;

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function addSearchTerm(terms: Set<string>, value: string | number | boolean | null | undefined): void {
  if (value === null || value === undefined) {
    return;
  }

  const normalizedValue = String(value).trim();
  if (normalizedValue) {
    terms.add(normalizedValue);
  }
}

export function getInstrumentationSearchTerms(instrumentation: InstrumentationData): string[] {
  const terms = new Set<string>();

  addSearchTerm(terms, instrumentation.name);
  addSearchTerm(terms, instrumentation.display_name);
  addSearchTerm(terms, instrumentation.description);
  addSearchTerm(terms, instrumentation.library_link);
  addSearchTerm(terms, instrumentation.source_path);
  addSearchTerm(terms, instrumentation.minimum_java_version);
  addSearchTerm(terms, instrumentation.scope.name);
  addSearchTerm(terms, instrumentation.scope.schema_url);

  instrumentation.semantic_conventions?.forEach((value) => addSearchTerm(terms, value));
  instrumentation.features?.forEach((value) => addSearchTerm(terms, value));
  instrumentation.javaagent_target_versions?.forEach((value) => addSearchTerm(terms, value));

  instrumentation.configurations?.forEach((configuration) => {
    addSearchTerm(terms, configuration.name);
    addSearchTerm(terms, configuration.declarative_name);
    addSearchTerm(terms, configuration.description);
    addSearchTerm(terms, configuration.type);
    addSearchTerm(terms, configuration.default);
    configuration.example?.forEach((value) => addSearchTerm(terms, value));
  });

  instrumentation.telemetry?.forEach((telemetry) => {
    addSearchTerm(terms, telemetry.when);

    telemetry.metrics?.forEach((metric) => {
      addSearchTerm(terms, metric.name);
      addSearchTerm(terms, metric.description);
      addSearchTerm(terms, metric.instrument);
      addSearchTerm(terms, metric.data_type);
      addSearchTerm(terms, metric.unit);

      metric.attributes?.forEach((attribute) => {
        addSearchTerm(terms, attribute.name);
        addSearchTerm(terms, attribute.type);
      });
    });

    telemetry.spans?.forEach((span) => {
      addSearchTerm(terms, span.span_kind);

      span.attributes?.forEach((attribute) => {
        addSearchTerm(terms, attribute.name);
        addSearchTerm(terms, attribute.type);
      });
    });
  });

  return [...terms];
}

function getMatchRank(result: SearchResult, normalizedQuery: string): number {
  const title = normalizeText(result.title);
  const description = normalizeText(result.description);
  const keywords = (result.keywords ?? []).map(normalizeText);

  if (title.includes(normalizedQuery)) return 0;
  if (description.includes(normalizedQuery)) return 1;
  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) return 2;
  return 3;
}

function sortResults(results: SearchResult[], normalizedQuery: string): SearchResult[] {
  return results.sort((left, right) => {
    const rankDifference = getMatchRank(left, normalizedQuery) - getMatchRank(right, normalizedQuery);
    if (rankDifference !== 0) {
      return rankDifference;
    }

    return left.title.localeCompare(right.title);
  });
}

export function matchesSearch(query: string, ...values: Array<string | null | undefined>): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;

  return values.some((value) => normalizeText(value ?? "").includes(normalizedQuery));
}

function toJavaAgentResult(
  instrumentation: InstrumentationData,
  version: string,
  resultType: SearchResult["type"] = "item"
): SearchResult {
  const title = instrumentation.display_name ?? instrumentation.name;

  return {
    title,
    description: instrumentation.description ?? "OpenTelemetry Java Agent instrumentation",
    path: `/java-agent/instrumentation/${version}/${instrumentation.name}`,
    type: resultType,
    keywords: [
      ...getInstrumentationSearchTerms(instrumentation),
      `/java-agent/instrumentation/${version}/${instrumentation.name}`,
    ],
  };
}

function toCollectorResult(
  component: CollectorComponent,
  version: string,
  resultType: SearchResult["type"] = "item"
): SearchResult {
  return {
    title: component.display_name ?? component.name,
    description: component.description ?? "OpenTelemetry Collector component",
    path: `/collector/components/${component.distribution}/${component.name}?version=${version}`,
    type: resultType,
    keywords: [component.id, component.name, component.distribution, component.type].filter(
      (value): value is string => Boolean(value)
    ),
  };
}

async function loadJavaAgentSearchResults(): Promise<SearchResult[]> {
  const versionsIndex = await loadJavaAgentVersions();
  const latestVersion = versionsIndex.versions.find((version) => version.is_latest)?.version;

  if (!latestVersion) {
    return [];
  }

  const instrumentations = await loadAllInstrumentations(latestVersion);
  return instrumentations.map((instrumentation) => toJavaAgentResult(instrumentation, latestVersion));
}

async function loadCollectorSearchResults(): Promise<SearchResult[]> {
  const versionsIndex = await loadCollectorVersions();
  const latestVersion = versionsIndex.versions.find((version) => version.is_latest)?.version;

  if (!latestVersion) {
    return [];
  }

  const components = await loadAllComponents(latestVersion);
  return components.map((component) => toCollectorResult(component, latestVersion));
}

async function buildSearchIndex(): Promise<SearchResult[]> {
  const [javaAgentResults, collectorResults] = await Promise.all([
    loadJavaAgentSearchResults().catch(() => []),
    loadCollectorSearchResults().catch(() => []),
  ]);

  return [...pageSearchResults, ...javaAgentResults, ...collectorResults];
}

async function getSearchIndex(): Promise<SearchResult[]> {
  if (!searchIndexPromise) {
    searchIndexPromise = buildSearchIndex();
  }

  return searchIndexPromise;
}

/**
 * Search through available content.
 * @param query Search query string.
 * @returns Array of matching search results.
 */
export async function search(query: string): Promise<SearchResult[]> {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const searchIndex = await getSearchIndex();
  const filtered = searchIndex.filter((item) =>
    matchesSearch(normalizedQuery, item.title, item.description, ...(item.keywords ?? []))
  );

  return sortResults(filtered, normalizedQuery);
}
