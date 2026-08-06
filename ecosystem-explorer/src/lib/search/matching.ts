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
 * Ecosystem-agnostic matching engine: normalization, substring matching, and
 * relevance ranking. Knows nothing about any ecosystem — it operates purely on
 * the generic `SearchResult` shape, so every source ranks by the same rules.
 */

import type { SearchResult } from "./types";

/** Canonical comparison form for every substring scan: trimmed + lowercased. */
export function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

/** Lower rank = better match. Title beats description beats keyword. */
function getMatchRank(result: SearchResult, normalizedQuery: string): number {
  const title = normalizeText(result.title);
  const description = normalizeText(result.description);
  const keywords = (result.keywords ?? []).map(normalizeText);

  if (title.includes(normalizedQuery)) return 0;
  if (description.includes(normalizedQuery)) return 1;
  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) return 2;
  return 3;
}

/** Sorts by match rank, breaking ties alphabetically by title. Mutates in place. */
export function sortResults(results: SearchResult[], normalizedQuery: string): SearchResult[] {
  return results.sort((left, right) => {
    const rankDifference =
      getMatchRank(left, normalizedQuery) - getMatchRank(right, normalizedQuery);
    if (rankDifference !== 0) {
      return rankDifference;
    }
    return left.title.localeCompare(right.title);
  });
}

/** True when the query is empty or appears (case-insensitively) in any value. */
export function matchesSearch(query: string, ...values: Array<string | null | undefined>): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;

  return values.some((value) => normalizeText(value ?? "").includes(normalizedQuery));
}
