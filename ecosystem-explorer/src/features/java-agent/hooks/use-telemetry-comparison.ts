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

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { InstrumentationData, TelemetryDiffResult } from "@/types/javaagent";
import * as javaagentData from "@/lib/api/javaagent-data";
import { compareTelemetry, getAvailableWhenConditions } from "../utils/telemetry-diff";

export interface UseTelemetryComparisonResult {
  fromVersion: string;
  toVersion: string;
  setFromVersion: (version: string) => void;
  setToVersion: (version: string) => void;
  whenCondition: string;
  setWhenCondition: (when: string) => void;
  availableConditions: string[];
  diffResult: TelemetryDiffResult | null;
  loading: boolean;
  error: Error | null;
  fromNotFound: boolean;
  toNotFound: boolean;
}

export function useTelemetryComparison(
  instrumentationName: string,
  initialFromVersion: string,
  initialToVersion: string
): UseTelemetryComparisonResult {
  const { t } = useTranslation("java-agent");
  const [customFromVersion, setCustomFromVersion] = useState<string | null>(null);
  const [customToVersion, setCustomToVersion] = useState<string | null>(null);
  const [whenCondition, setWhenCondition] = useState<string>("default");
  const [availableConditions, setAvailableConditions] = useState<string[]>(["default"]);
  const [diffResult, setDiffResult] = useState<TelemetryDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromNotFound, setFromNotFound] = useState(false);
  const [toNotFound, setToNotFound] = useState(false);
  const fromInstrRef = useRef<InstrumentationData | null>(null);
  const toInstrRef = useRef<InstrumentationData | null>(null);
  // Allows the in-flight loadComparison() closure below to read the latest whenCondition
  // instead of the value captured when the effect was created (see #795).
  const whenConditionRef = useRef(whenCondition);
  // eslint-disable-next-line react-hooks/refs
  whenConditionRef.current = whenCondition;

  const fromVersion = customFromVersion ?? initialFromVersion;
  const toVersion = customToVersion ?? initialToVersion;

  useEffect(() => {
    let cancelled = false;

    async function loadComparison() {
      if (!instrumentationName || !fromVersion || !toVersion) {
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
        // Load both instrumentations in parallel
        const [fromData, toData] = await Promise.allSettled([
          javaagentData.loadInstrumentation(instrumentationName, fromVersion),
          javaagentData.loadInstrumentation(instrumentationName, toVersion),
        ]);

        if (cancelled) return;

        const fromInstrumentation = fromData.status === "fulfilled" ? fromData.value : null;
        const fromLoadFailed = fromData.status === "rejected";

        const toInstrumentation = toData.status === "fulfilled" ? toData.value : null;
        const toLoadFailed = toData.status === "rejected";

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

        fromInstrRef.current = fromInstrumentation;
        toInstrRef.current = toInstrumentation;

        const conditions = getAvailableWhenConditions(fromInstrumentation, toInstrumentation);
        setAvailableConditions(conditions);

        const currentWhenCondition = whenConditionRef.current;
        const fallbackCondition = conditions.includes("default") ? "default" : conditions[0];
        const activeCondition = conditions.includes(currentWhenCondition)
          ? currentWhenCondition
          : fallbackCondition;
        if (activeCondition !== currentWhenCondition) {
          setWhenCondition(activeCondition);
        }

        // Compute diff even if one version is missing (will show all added/removed)
        const diff = compareTelemetry(fromInstrumentation, toInstrumentation, activeCondition);
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
  }, [instrumentationName, fromVersion, toVersion, t]);

  useEffect(() => {
    if (!fromInstrRef.current && !toInstrRef.current) return;
    if (fromVersion === toVersion) return;
    const diff = compareTelemetry(fromInstrRef.current, toInstrRef.current, whenCondition);
    setDiffResult(diff);
  }, [whenCondition]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    fromVersion,
    toVersion,
    setFromVersion: setCustomFromVersion,
    setToVersion: setCustomToVersion,
    whenCondition,
    setWhenCondition,
    availableConditions,
    diffResult,
    loading,
    error,
    fromNotFound,
    toNotFound,
  };
}
