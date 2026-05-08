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
import type { PrometheusVersionsIndex, PrometheusComponent } from "@/types/prometheus";
import type { DataState } from "./data-state";
import * as prometheusData from "@/lib/api/prometheus-data";

export function usePrometheusVersions(): DataState<PrometheusVersionsIndex> {
  const [state, setState] = useState<DataState<PrometheusVersionsIndex>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const data = await prometheusData.loadVersions();
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
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

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function usePrometheusComponents(version: string): DataState<PrometheusComponent[]> {
  const [state, setState] = useState<DataState<PrometheusComponent[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!version) {
        setState({ data: null, loading: false, error: null });
        return;
      }

      setState({ data: null, loading: true, error: null });

      try {
        const data = await prometheusData.loadAllComponents(version);
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
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

    loadData();

    return () => {
      cancelled = true;
    };
  }, [version]);

  return state;
}
