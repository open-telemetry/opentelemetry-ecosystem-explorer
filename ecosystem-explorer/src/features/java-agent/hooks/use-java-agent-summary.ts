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
import type { DataState } from "@/hooks/data-state";

export interface JavaAgentSummary {
  latestVersion: string;
  instrumentationCount: number;
}

export function useJavaAgentSummary(): DataState<JavaAgentSummary> {
  const [state, setState] = useState<DataState<JavaAgentSummary>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const versionsIndex = await javaagentData.loadVersions();
        if (cancelled) return;

        const latestVersionInfo =
          versionsIndex.versions.find((v) => v.is_latest) || versionsIndex.versions[0];

        if (!latestVersionInfo) {
          throw new Error("No Java Agent versions found");
        }

        const latestVersion = latestVersionInfo.version;
        const instrumentations = await javaagentData.loadAllInstrumentations(latestVersion);
        if (cancelled) return;

        setState({
          data: {
            latestVersion,
            instrumentationCount: instrumentations.length,
          },
          loading: false,
          error: null,
        });
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

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
