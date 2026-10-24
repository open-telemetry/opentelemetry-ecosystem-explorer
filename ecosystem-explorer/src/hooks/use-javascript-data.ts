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
import type { JavascriptIndex, JavascriptPackage } from "@/types/javascript";
import type { DataState } from "./data-state";
import * as javascriptData from "@/lib/api/javascript-data";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function useJavascriptIndex(): DataState<JavascriptIndex> {
  const [state, setState] = useState<DataState<JavascriptIndex>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const data = await javascriptData.loadIndex();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (error) {
        if (!cancelled) setState({ data: null, loading: false, error: toError(error) });
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

const PACKAGE_LOADING: DataState<JavascriptPackage> = { data: null, loading: true, error: null };

/** Loads one release of a package, or its latest release when `version` is omitted. */
export function useJavascriptPackage(name: string, version?: string): DataState<JavascriptPackage> {
  // Tag results with the request that produced them. The effect only resets state
  // after render, so without this the first render after `name` or `version`
  // changes would return the previous package (same approach as useInstrumentations).
  const key = `${name}@${version ?? ""}`;
  const [state, setState] = useState<DataState<JavascriptPackage> & { key: string }>({
    key,
    ...PACKAGE_LOADING,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!name) {
        setState({ key, data: null, loading: false, error: null });
        return;
      }

      try {
        const data = await javascriptData.loadPackage(name, version);
        if (!cancelled) setState({ key, data, loading: false, error: null });
      } catch (error) {
        if (!cancelled) setState({ key, data: null, loading: false, error: toError(error) });
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [key, name, version]);

  if (state.key !== key) return PACKAGE_LOADING;
  const { data, loading, error } = state;
  return { data, loading, error };
}
