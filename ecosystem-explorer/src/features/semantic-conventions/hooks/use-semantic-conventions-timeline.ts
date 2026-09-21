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
import type { DataState } from "@/hooks/data-state";
import { resolveDataPath } from "@/lib/api/fetch-with-cache";
import type { TimelineData } from "../types";

/*
 * Curated content, so it deliberately lives outside `data/{javaagent,collector,configuration}/`:
 * explorer-db-builder owns those directories and `--clean` rmtree's them wholesale, which
 * previously deleted a hand-maintained file placed inside one of them (#882). A future automated
 * watcher may take over keeping this file current, but it still has to write outside the
 * builder-owned tree.
 */
const TIMELINE_PATH = resolveDataPath("data/semantic-conventions", "timeline.json");

export function useSemanticConventionsTimeline(): DataState<TimelineData> {
  const [state, setState] = useState<DataState<TimelineData>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      try {
        const response = await fetch(TIMELINE_PATH);
        if (cancelled) return;

        if (!response.ok) {
          throw new Error(`Failed to load timeline: ${response.status} ${response.statusText}`);
        }

        const data: TimelineData = await response.json();
        if (cancelled) return;

        setState({ data, loading: false, error: null });
      } catch (error) {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    }

    loadTimeline();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
