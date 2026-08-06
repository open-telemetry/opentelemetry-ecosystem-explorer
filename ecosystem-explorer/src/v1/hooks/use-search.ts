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
import { useEffect, useState } from "react";
import type { DataState } from "@/hooks/data-state";
import { search, type SearchResult } from "@/lib/search";

/**
 * Runs the cross-ecosystem search engine for the given query and returns
 * a `DataState` snapshot. Blank queries short-circuit to an empty array
 * without hitting the engine. Callers should debounce the query if the
 * input source is a typeahead.
 */
export function useSearch(query: string): DataState<SearchResult[]> {
  const [state, setState] = useState<DataState<SearchResult[]>>({
    data: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!query.trim()) {
        setState({ data: [], loading: false, error: null });
        return;
      }

      setState((prev) => ({ data: prev.data, loading: true, error: null }));
      try {
        const results = await search(query);
        if (cancelled) return;
        setState({ data: results, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          data: [],
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return state;
}
