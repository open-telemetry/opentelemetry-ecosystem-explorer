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
import { compareTelemetry } from "../utils/telemetry-diff";
import { getInstrumentationDisplayName } from "../utils/format";
import type { InstrumentationData } from "@/types/javaagent";

export type InstrumentationDiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface InstrumentationReleaseDiff {
  name: string;
  displayName: string;
  status: InstrumentationDiffStatus;
  metricsAdded: number;
  metricsRemoved: number;
  metricsChanged: number;
  spansAdded: number;
  spansRemoved: number;
  spansChanged: number;
}

export interface ReleaseDiffSummary {
  instrumentationsAdded: number;
  instrumentationsRemoved: number;
  instrumentationsChanged: number;
  instrumentationsUnchanged: number;
  totalMetricsAdded: number;
  totalMetricsRemoved: number;
  totalMetricsChanged: number;
  totalSpansAdded: number;
  totalSpansRemoved: number;
  totalSpansChanged: number;
}

const STATUS_ORDER: Record<InstrumentationDiffStatus, number> = {
  added: 0,
  removed: 1,
  changed: 2,
  unchanged: 3,
};

function countDefaultTelemetry(
  instr: InstrumentationData,
  kind: "metrics" | "spans"
): number {
  const defaultTelemetry = instr.telemetry?.find((t) => t.when === "default");
  return defaultTelemetry?.[kind]?.length ?? 0;
}

export function computeReleaseDiff(
  fromInstrs: InstrumentationData[],
  toInstrs: InstrumentationData[]
): { diffs: InstrumentationReleaseDiff[]; summary: ReleaseDiffSummary } {
  const fromMap = new Map(fromInstrs.map((i) => [i.name, i]));
  const toMap = new Map(toInstrs.map((i) => [i.name, i]));
  const allNames = new Set([...fromMap.keys(), ...toMap.keys()]);

  const diffs: InstrumentationReleaseDiff[] = [];

  for (const name of allNames) {
    const fromInstr = fromMap.get(name) ?? null;
    const toInstr = toMap.get(name) ?? null;
    const displayName = getInstrumentationDisplayName((toInstr ?? fromInstr)!);

    if (!fromInstr && toInstr) {
      diffs.push({
        name,
        displayName,
        status: "added",
        metricsAdded: countDefaultTelemetry(toInstr, "metrics"),
        metricsRemoved: 0,
        metricsChanged: 0,
        spansAdded: countDefaultTelemetry(toInstr, "spans"),
        spansRemoved: 0,
        spansChanged: 0,
      });
      continue;
    }

    if (fromInstr && !toInstr) {
      diffs.push({
        name,
        displayName,
        status: "removed",
        metricsAdded: 0,
        metricsRemoved: countDefaultTelemetry(fromInstr, "metrics"),
        metricsChanged: 0,
        spansAdded: 0,
        spansRemoved: countDefaultTelemetry(fromInstr, "spans"),
        spansChanged: 0,
      });
      continue;
    }

    const diffResult = compareTelemetry(fromInstr, toInstr, "default");
    const metricsAdded = diffResult.metrics.filter((m) => m.status === "added").length;
    const metricsRemoved = diffResult.metrics.filter((m) => m.status === "removed").length;
    const metricsChanged = diffResult.metrics.filter((m) => m.status === "changed").length;
    const spansAdded = diffResult.spans.filter((s) => s.status === "added").length;
    const spansRemoved = diffResult.spans.filter((s) => s.status === "removed").length;
    const spansChanged = diffResult.spans.filter((s) => s.status === "changed").length;

    const hasChanges =
      metricsAdded + metricsRemoved + metricsChanged + spansAdded + spansRemoved + spansChanged > 0;

    diffs.push({
      name,
      displayName,
      status: hasChanges ? "changed" : "unchanged",
      metricsAdded,
      metricsRemoved,
      metricsChanged,
      spansAdded,
      spansRemoved,
      spansChanged,
    });
  }

  diffs.sort((a, b) => {
    const order = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (order !== 0) return order;
    return a.displayName.localeCompare(b.displayName);
  });

  const summary: ReleaseDiffSummary = {
    instrumentationsAdded: diffs.filter((d) => d.status === "added").length,
    instrumentationsRemoved: diffs.filter((d) => d.status === "removed").length,
    instrumentationsChanged: diffs.filter((d) => d.status === "changed").length,
    instrumentationsUnchanged: diffs.filter((d) => d.status === "unchanged").length,
    totalMetricsAdded: diffs.reduce((s, d) => s + d.metricsAdded, 0),
    totalMetricsRemoved: diffs.reduce((s, d) => s + d.metricsRemoved, 0),
    totalMetricsChanged: diffs.reduce((s, d) => s + d.metricsChanged, 0),
    totalSpansAdded: diffs.reduce((s, d) => s + d.spansAdded, 0),
    totalSpansRemoved: diffs.reduce((s, d) => s + d.spansRemoved, 0),
    totalSpansChanged: diffs.reduce((s, d) => s + d.spansChanged, 0),
  };

  return { diffs, summary };
}

export interface UseReleaseDiffResult {
  diffs: InstrumentationReleaseDiff[];
  summary: ReleaseDiffSummary | null;
  loading: boolean;
  error: Error | null;
}

export function useReleaseDiff(fromVersion: string, toVersion: string): UseReleaseDiffResult {
  const [diffs, setDiffs] = useState<InstrumentationReleaseDiff[]>([]);
  const [summary, setSummary] = useState<ReleaseDiffSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!fromVersion || !toVersion || fromVersion === toVersion) {
        setDiffs([]);
        setSummary(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setDiffs([]);
      setSummary(null);

      try {
        const [fromInstrs, toInstrs] = await Promise.all([
          javaagentData.loadAllInstrumentations(fromVersion),
          javaagentData.loadAllInstrumentations(toVersion),
        ]);

        if (cancelled) return;

        const result = computeReleaseDiff(fromInstrs, toInstrs);
        setDiffs(result.diffs);
        setSummary(result.summary);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fromVersion, toVersion]);

  return { diffs, summary, loading, error };
}
