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

import { useState, useEffect } from "react";
import * as javaagentData from "@/lib/api/javaagent-data";
import { compareReleases, type ReleaseDiff } from "../utils/release-diff";

/**
 * Custom hook to fetch instrumentation data for two Java Agent versions and compute the difference.
 *
 * Loads only the modules whose content hash differs between the two versions
 * (see `loadComparisonDetails`), so `diff.aggregateMetrics` is intentionally
 * empty — the "all metrics" table is a whole-release rollup and is loaded
 * separately by `useAggregateMetrics` when that tab is opened.
 *
 * @param fromVersion The base version for comparison
 * @param toVersion The target version for comparison
 * @param validVersions Known versions, newest first. While empty the hook stays
 *   idle rather than comparing against an unvalidated pair — the version list
 *   arrives a moment after first render, and starting early would throw the
 *   whole comparison away when it lands.
 * @returns An object containing the diff results, loading state, and any error encountered
 */
export function useReleaseComparison(
  fromVersion: string,
  toVersion: string,
  validVersions: string[] = []
) {
  const [diff, setDiff] = useState<ReleaseDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadComparison() {
      if (!fromVersion || !toVersion) {
        setDiff(null);
        setLoading(false);
        setError(null);
        return;
      }
      if (fromVersion === toVersion) {
        setDiff(null);
        setLoading(false);
        setError(null);
        return;
      }

      // Stay idle until the version list is known. It lands one request after
      // first render; comparing before it arrives would start a full load that
      // the very next render discards, doubling the work on every page open.
      if (validVersions.length === 0) {
        setDiff(null);
        setLoading(true);
        setError(null);
        return;
      }

      const fromIndex = validVersions.indexOf(fromVersion);
      const toIndex = validVersions.indexOf(toVersion);
      if (fromIndex === -1 || toIndex === -1 || fromIndex <= toIndex) {
        setDiff(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setDiff(null); // Clear previous diff to avoid showing stale data

      try {
        const { fromData, toData } = await javaagentData.loadComparisonDetails(
          fromVersion,
          toVersion
        );

        if (cancelled) return;

        if (!fromData || !toData) {
          throw new Error("Failed to load instrumentation data for one or both versions.");
        }

        const result = compareReleases(fromVersion, toVersion, fromData, toData, {
          includeAggregateMetrics: false,
        });
        setDiff(result);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setDiff(null);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    loadComparison();

    return () => {
      cancelled = true;
    };
  }, [fromVersion, toVersion, validVersions]);

  return { diff, loading, error };
}
