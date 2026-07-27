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
import { useTranslation } from "react-i18next";
import type { CollectorComponent, CollectorTelemetryDiffResult } from "@/types/collector";
import * as collectorData from "@/lib/api/collector-data";
import { compareTelemetryMetrics } from "../utils/telemetry-diff";

export interface UseCollectorTelemetryComparisonResult {
  fromVersion: string;
  toVersion: string;
  setFromVersion: (version: string) => void;
  setToVersion: (version: string) => void;
  diffResult: CollectorTelemetryDiffResult | null;
  loading: boolean;
  error: Error | null;
  fromNotFound: boolean;
  toNotFound: boolean;
}

/**
 * Compares the internal self-observability telemetry (`telemetry.metrics`) of
 * one Collector component across two versions. Unlike the Java Agent
 * equivalent, there is no when-condition state to track here: Collector
 * metadata has no configuration-dependent telemetry axis.
 */
export function useTelemetryComparison(
  distribution: string,
  name: string,
  initialFromVersion: string,
  initialToVersion: string
): UseCollectorTelemetryComparisonResult {
  const { t } = useTranslation("collector");
  const [customFromVersion, setCustomFromVersion] = useState<string | null>(null);
  const [customToVersion, setCustomToVersion] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<CollectorTelemetryDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromNotFound, setFromNotFound] = useState(false);
  const [toNotFound, setToNotFound] = useState(false);

  const fromVersion = customFromVersion ?? initialFromVersion;
  const toVersion = customToVersion ?? initialToVersion;

  useEffect(() => {
    let cancelled = false;

    async function loadComparison() {
      if (!distribution || !name || !fromVersion || !toVersion) {
        setDiffResult(null);
        setLoading(false);
        setError(null);
        setFromNotFound(false);
        setToNotFound(false);
        return;
      }

      if (fromVersion === toVersion) {
        setDiffResult(null);
        setLoading(false);
        setError(null);
        setFromNotFound(false);
        setToNotFound(false);
        return;
      }

      setLoading(true);
      setError(null);
      setFromNotFound(false);
      setToNotFound(false);

      try {
        const [fromResult, toResult] = await Promise.allSettled([
          collectorData.loadComponent(distribution, name, fromVersion),
          collectorData.loadComponent(distribution, name, toVersion),
        ]);

        if (cancelled) return;

        const fromComponent: CollectorComponent | null =
          fromResult.status === "fulfilled" ? fromResult.value : null;
        const fromLoadFailed = fromResult.status === "rejected";

        const toComponent: CollectorComponent | null =
          toResult.status === "fulfilled" ? toResult.value : null;
        const toLoadFailed = toResult.status === "rejected";

        if (fromLoadFailed && toLoadFailed) {
          setError(new Error(t("telemetryComparison.error.bothVersionsFailed")));
          setFromNotFound(true);
          setToNotFound(true);
          setDiffResult(null);
          setLoading(false);
          return;
        }

        if (fromLoadFailed) {
          setFromNotFound(true);
        }

        if (toLoadFailed) {
          setToNotFound(true);
        }

        const diff = compareTelemetryMetrics(fromComponent, toComponent);
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
  }, [distribution, name, fromVersion, toVersion, t]);

  return {
    fromVersion,
    toVersion,
    setFromVersion: setCustomFromVersion,
    setToVersion: setCustomToVersion,
    diffResult,
    loading,
    error,
    fromNotFound,
    toNotFound,
  };
}
