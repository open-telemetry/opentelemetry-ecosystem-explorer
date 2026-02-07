import { useState, useEffect } from "react";
import type { VersionsIndex, InstrumentationData } from "@/types/javaagent";
import * as javaagentData from "@/lib/api/javaagent-data";

interface DataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useVersions(): DataState<VersionsIndex> {
  const [state, setState] = useState<DataState<VersionsIndex>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const data = await javaagentData.loadVersions();
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

export function useInstrumentations(version: string): DataState<InstrumentationData[]> {
  const [state, setState] = useState<DataState<InstrumentationData[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setState({ data: null, loading: true, error: null });

      try {
        const data = await javaagentData.loadAllInstrumentations(version);
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

    if (version) {
      loadData();
    }

    return () => {
      cancelled = true;
    };
  }, [version]);

  return state;
}
