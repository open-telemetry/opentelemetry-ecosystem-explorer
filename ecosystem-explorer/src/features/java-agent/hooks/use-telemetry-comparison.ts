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
import type { TelemetryDiffResult } from "@/types/javaagent";
import * as javaagentData from "@/lib/api/javaagent-data";
import { compareTelemetry } from "../utils/telemetry-diff";

export interface UseTelemetryComparisonResult {
  baseVersion: string;
  comparisonVersion: string;
  setBaseVersion: (version: string) => void;
  setComparisonVersion: (version: string) => void;
  diffResult: TelemetryDiffResult | null;
  loading: boolean;
  error: Error | null;
  baseNotFound: boolean;
  comparisonNotFound: boolean;
}

export function useTelemetryComparison(
  instrumentationName: string,
  initialBaseVersion: string,
  initialComparisonVersion: string
): UseTelemetryComparisonResult {
  const [baseVersion, setBaseVersion] = useState(initialBaseVersion);
  const [comparisonVersion, setComparisonVersion] = useState(initialComparisonVersion);
  const [diffResult, setDiffResult] = useState<TelemetryDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [baseNotFound, setBaseNotFound] = useState(false);
  const [comparisonNotFound, setComparisonNotFound] = useState(false);

  useEffect(() => {
    setBaseVersion(initialBaseVersion);
    setComparisonVersion(initialComparisonVersion);
  }, [initialBaseVersion, initialComparisonVersion]);

  useEffect(() => {
    let cancelled = false;

    async function loadComparison() {
      if (!instrumentationName || !baseVersion || !comparisonVersion) {
        setDiffResult(null);
        setLoading(false);
        setError(null);
        setBaseNotFound(false);
        setComparisonNotFound(false);
        return;
      }

      if (baseVersion === comparisonVersion) {
        setDiffResult(null);
        setLoading(false);
        setError(null);
        setBaseNotFound(false);
        setComparisonNotFound(false);
        return;
      }

      setLoading(true);
      setError(null);
      setBaseNotFound(false);
      setComparisonNotFound(false);

      try {
        // Load both instrumentations in parallel
        const [baseData, comparisonData] = await Promise.allSettled([
          javaagentData.loadInstrumentation(instrumentationName, baseVersion),
          javaagentData.loadInstrumentation(instrumentationName, comparisonVersion),
        ]);

        if (cancelled) return;

        // Check if base version failed
        const baseInstrumentation = baseData.status === "fulfilled" ? baseData.value : null;
        const baseLoadFailed = baseData.status === "rejected";

        // Check if comparison version failed
        const comparisonInstrumentation =
          comparisonData.status === "fulfilled" ? comparisonData.value : null;
        const comparisonLoadFailed = comparisonData.status === "rejected";

        if (baseLoadFailed && comparisonLoadFailed) {
          setError(
            new Error(
              "Both versions could not be loaded. The instrumentation may not exist in these versions."
            )
          );
          setBaseNotFound(true);
          setComparisonNotFound(true);
          setDiffResult(null);
          setLoading(false);
          return;
        }

        if (baseLoadFailed) {
          setBaseNotFound(true);
        }

        if (comparisonLoadFailed) {
          setComparisonNotFound(true);
        }

        // Compute diff even if one version is missing (will show all added/removed)
        const diff = compareTelemetry(baseInstrumentation, comparisonInstrumentation);
        setDiffResult(diff);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setDiffResult(null);
          setLoading(false);
        }
      }
    }

    loadComparison();

    return () => {
      cancelled = true;
    };
  }, [instrumentationName, baseVersion, comparisonVersion]);

  return {
    baseVersion,
    comparisonVersion,
    setBaseVersion,
    setComparisonVersion,
    diffResult,
    loading,
    error,
    baseNotFound,
    comparisonNotFound,
  };
}
