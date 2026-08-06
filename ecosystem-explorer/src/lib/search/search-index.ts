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
 * Cross-ecosystem search index used by `<GlobalSearch>` on the v1 home.
 *
 * Lazily builds an in-memory index from every registered `SearchSource` (static
 * pages plus the latest version of each data-backed ecosystem), then memoizes
 * it under module scope so subsequent queries are synchronous filters over an
 * in-memory array. No external dependency: the matcher is a case-insensitive
 * substring scan, ranked by title > description > keyword.
 */

import { matchesSearch, normalizeText, sortResults } from "./matching";
import { SEARCH_SOURCES } from "./sources";
import type { SearchResult } from "./types";

let searchIndexPromise: Promise<SearchResult[]> | null = null;

async function buildSearchIndex(): Promise<SearchResult[]> {
  // Load every source independently. A source that rejects contributes nothing
  // and flips the cache off (below), so a partial outage (one ecosystem down)
  // isn't cached for the session — the next `search()` rebuilds and retries
  // instead of serving a permanently-degraded index.
  const loaded = await Promise.all(SEARCH_SOURCES.map((source) => source.load().catch(() => null)));

  if (loaded.some((results) => results === null)) {
    searchIndexPromise = null;
  }

  return loaded.flatMap((results) => results ?? []);
}

async function getSearchIndex(): Promise<SearchResult[]> {
  if (!searchIndexPromise) {
    searchIndexPromise = buildSearchIndex();
  }
  return searchIndexPromise;
}

/**
 * Search across pages, Java Agent instrumentations, and Collector components.
 * Empty / whitespace queries return an empty array.
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
