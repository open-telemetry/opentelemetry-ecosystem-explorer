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
 * @param fromVersion The base version for comparison
 * @param toVersion The target version for comparison
 * @returns An object containing the diff results, loading state, and any error encountered
 */
export function useReleaseComparison(fromVersion: string, toVersion: string) {
  const [diff, setDiff] = useState<ReleaseDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadComparison() {
      if (!fromVersion || !toVersion) return;
      if (fromVersion === toVersion) {
        setDiff(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [fromData, toData] = await Promise.all([
          javaagentData.loadAllInstrumentations(fromVersion),
          javaagentData.loadAllInstrumentations(toVersion),
        ]);

        if (cancelled) return;

        const result = compareReleases(fromVersion, toVersion, fromData, toData);
        setDiff(result);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    loadComparison();

    return () => {
      cancelled = true;
    };
  }, [fromVersion, toVersion]);

  return { diff, loading, error };
}
