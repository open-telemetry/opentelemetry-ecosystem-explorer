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
import type { ConfigVersionsIndex, ConfigNode, ConfigStarter } from "@/types/configuration";
import type { DataState } from "./data-state";
import * as configData from "@/lib/api/configuration-data";

export function useConfigVersions(): DataState<ConfigVersionsIndex> {
  const [state, setState] = useState<DataState<ConfigVersionsIndex>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const data = await configData.loadConfigVersions();
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

export function useConfigSchema(version: string): DataState<ConfigNode> {
  const [state, setState] = useState<DataState<ConfigNode>>({
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
        const data = await configData.loadConfigSchema(version);
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

export function useConfigStarter(version: string): DataState<ConfigStarter | null> {
  const [state, setState] = useState<DataState<ConfigStarter | null>>({
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
        const data = await configData.loadConfigStarter(version);
        if (!cancelled) setState({ data, loading: false, error: null });
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
