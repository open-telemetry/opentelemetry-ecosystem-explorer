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
import { computeAggregateMetrics, type AggregateMetric } from "../utils/release-diff";

/**
 * Loads every metric emitted by a release, on demand.
 *
 * This is a whole-release rollup, so it needs detail for all ~250 modules —
 * far more than the comparison itself, which only loads the modules that
 * changed. Keeping it behind `enabled` means opening the comparison page pays
 * for the diff alone; the larger load happens only if the reader actually opens
 * the metrics tab, and by then the changed modules are already cached.
 *
 * @param version The release to roll metrics up from
 * @param enabled Whether to load. Stays idle (and keeps prior results) while false.
 */
export function useAggregateMetrics(version: string, enabled: boolean) {
  // Tagged with the version it was loaded for so a version change is never
  // shown alongside data loaded for the previous one: React runs this effect
  // after paint, so the first render after `version` changes would otherwise
  // repaint with the old `metrics` value for one frame before the fetch below
  // even starts.
  const [state, setState] = useState<{ version: string; metrics: AggregateMetric[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!enabled || !version) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await javaagentData.loadAllInstrumentationDetails(version);
        if (cancelled) return;
        setState({ version, metrics: computeAggregateMetrics(data) });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [version, enabled]);

  const metrics = state?.version === version ? state.metrics : null;

  return { metrics, loading, error };
}
