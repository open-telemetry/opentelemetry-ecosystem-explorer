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
import { resolveDataPath } from "@/lib/api/fetch-with-cache";

export const JAVA_AGENT_ECOSYSTEM_STATS_URL = "/data/javaagent/ecosystem-stats.json";
export const COLLECTOR_ECOSYSTEM_STATS_URL = "/data/collector/ecosystem-stats.json";

interface JavaAgentStatsShape {
  version_count: number;
  library_count: number;
}

interface CollectorStatsShape {
  version_count: number;
  component_count: number;
}

export interface EcosystemStats {
  javaAgent: JavaAgentStatsShape;
  collector: CollectorStatsShape;
}

export interface UseEcosystemStatsOptions {
  javaAgentStatsUrl?: string;
  collectorStatsUrl?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  // Intentionally not using cache for this data
  const res = await fetch(resolveDataPath(url));
  if (!res.ok) throw new Error(`${url} responded with ${res.status}`);
  return (await res.json()) as T;
}

export function useEcosystemStats({
  javaAgentStatsUrl = JAVA_AGENT_ECOSYSTEM_STATS_URL,
  collectorStatsUrl = COLLECTOR_ECOSYSTEM_STATS_URL,
}: UseEcosystemStatsOptions = {}): DataState<EcosystemStats> {
  const [state, setState] = useState<DataState<EcosystemStats>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ data: null, loading: true, error: null });
      try {
        const [javaAgent, collector] = await Promise.all([
          fetchJson<JavaAgentStatsShape>(javaAgentStatsUrl),
          fetchJson<CollectorStatsShape>(collectorStatsUrl),
        ]);
        if (cancelled) return;
        setState({ data: { javaAgent, collector }, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [javaAgentStatsUrl, collectorStatsUrl]);

  return state;
}
