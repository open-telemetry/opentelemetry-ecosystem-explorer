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
import type { ContribEntry } from "@/types/java-contrib";
import { loadAllContribComponents, loadContribComponent } from "@/lib/api/java-contrib-data";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function useContribComponents(): DataState<ContribEntry[]> {
  const [state, setState] = useState<DataState<ContribEntry[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const data = await loadAllContribComponents();
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ data: null, loading: false, error: toError(error) });
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useContribComponent(id: string): DataState<ContribEntry> {
  // Tag results with the id that produced them so a param change never shows the previous entry.
  const [state, setState] = useState<DataState<ContribEntry> & { id: string }>({
    id,
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const data = await loadContribComponent(id);
        if (!cancelled) {
          setState({ id, data, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ id, data: null, loading: false, error: toError(error) });
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.id !== id) {
    return { data: null, loading: true, error: null };
  }
  return { data: state.data, loading: state.loading, error: state.error };
}
