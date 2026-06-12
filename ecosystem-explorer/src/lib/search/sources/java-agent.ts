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

import { loadIndex, loadVersions as loadJavaAgentVersions } from "@/lib/api/javaagent-data";
import type { InstrumentationIndexEntry } from "@/types/javaagent";
import type { SearchResult, SearchSource } from "../types";

function addSearchTerm(terms: Set<string>, value: string | null | undefined): void {
  if (value === null || value === undefined) {
    return;
  }
  const normalizedValue = value.trim();
  if (normalizedValue) {
    terms.add(normalizedValue);
  }
}

/**
 * Searchable terms for a slim index entry: always seeds name/display_name/description,
 * then folds in the precomputed `search_terms`. When `search_terms` is absent (older
 * indexes), search degrades to the three seeds rather than failing.
 */
export function getInstrumentationSearchTerms(entry: InstrumentationIndexEntry): string[] {
  const terms = new Set<string>();
  addSearchTerm(terms, entry.name);
  addSearchTerm(terms, entry.display_name);
  addSearchTerm(terms, entry.description);
  entry.search_terms?.forEach((value) => addSearchTerm(terms, value));
  return [...terms];
}

/** Maps a Java Agent index entry to a search result. Exported for unit tests. */
export function toJavaAgentResult(
  entry: InstrumentationIndexEntry,
  version: string,
  resultType: SearchResult["type"] = "item"
): SearchResult {
  const path = `/java-agent/instrumentation/${version}/${entry.name}`;
  return {
    title: entry.display_name ?? entry.name,
    description: entry.description ?? "OpenTelemetry Java Agent instrumentation",
    path,
    type: resultType,
    // The full instrumentation path is indexed as a keyword so path queries match.
    keywords: [...getInstrumentationSearchTerms(entry), path],
    ecosystem: "java-agent",
    version,
    // Most instrumentations run via the agent, so an "agent" facet would just
    // repeat the ecosystem pill. The non-obvious signal is whether one also
    // ships as a standalone library (usable without the agent) — surface only
    // that. Stability is omitted: Java Agent doesn't track it per-instrumentation.
    facets: entry.has_standalone_library ? ["standalone library"] : [],
  };
}

async function loadJavaAgentSearchResults(): Promise<SearchResult[]> {
  // Two fetches (index.json + versions-index.json), no per-instrumentation fan-out.
  const [versionsIndex, index] = await Promise.all([loadJavaAgentVersions(), loadIndex()]);
  const latestVersion = versionsIndex.versions.find((version) => version.is_latest)?.version;
  if (!latestVersion) return [];

  return index.components.map((entry) => toJavaAgentResult(entry, latestVersion));
}

export const javaAgentSearchSource: SearchSource = {
  id: "java-agent",
  load: loadJavaAgentSearchResults,
};
