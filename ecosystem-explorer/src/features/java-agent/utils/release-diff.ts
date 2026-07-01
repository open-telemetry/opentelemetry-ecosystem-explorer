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

import type {
  InstrumentationData,
  TelemetryDiffResult,
  MetricDiff,
  SpanDiff,
  Span,
  Metric,
  Attribute,
} from "@/types/javaagent";
import { compareTelemetry, getAvailableWhenConditions } from "./telemetry-diff";

function attrsKey(attrs: Attribute[] | undefined): string {
  if (!attrs || attrs.length === 0) return "";
  return [...attrs]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => `${a.name}:${a.type}`)
    .join("|");
}

function spansIdentical(a: Span, b: Span): boolean {
  return a.span_kind === b.span_kind && attrsKey(a.attributes) === attrsKey(b.attributes);
}

function metricsIdentical(a: Metric, b: Metric): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.data_type === b.data_type &&
    a.unit === b.unit &&
    a.instrument === b.instrument &&
    attrsKey(a.attributes) === attrsKey(b.attributes)
  );
}

/**
 * Collapses (removed, added) pairs that are structurally identical across
 * different when-conditions into a single "changed" entry. This prevents a span
 * or metric that was merely re-labelled to a different when-condition from
 * appearing as both removed and added in the comparison UI. The collapsed entry
 * carries the new whenCondition so the UI can display the change context.
 */
function deduplicateSpanDiffs(spans: SpanDiff[]): SpanDiff[] {
  const passThrough = spans.filter((s) => s.status !== "removed" && s.status !== "added");
  const removed = spans.filter((s) => s.status === "removed");
  const added = spans.filter((s) => s.status === "added");

  const consumed = new Set<number>();
  const result: SpanDiff[] = [];

  for (const removedEntry of removed) {
    const matchIdx = added.findIndex(
      (a, i) => !consumed.has(i) && spansIdentical(removedEntry.span, a.span)
    );
    if (matchIdx !== -1) {
      consumed.add(matchIdx);
      result.push({
        status: "changed",
        span: added[matchIdx].span,
        whenCondition: added[matchIdx].whenCondition,
      });
    } else {
      result.push(removedEntry);
    }
  }

  for (let i = 0; i < added.length; i++) {
    if (!consumed.has(i)) {
      result.push(added[i]);
    }
  }

  return [...passThrough, ...result];
}

function deduplicateMetricDiffs(metrics: MetricDiff[]): MetricDiff[] {
  const passThrough = metrics.filter((m) => m.status !== "removed" && m.status !== "added");
  const removed = metrics.filter((m) => m.status === "removed");
  const added = metrics.filter((m) => m.status === "added");

  const consumed = new Set<number>();
  const result: MetricDiff[] = [];

  for (const removedEntry of removed) {
    const matchIdx = added.findIndex(
      (a, i) => !consumed.has(i) && metricsIdentical(removedEntry.metric, a.metric)
    );
    if (matchIdx !== -1) {
      consumed.add(matchIdx);
      result.push({
        status: "changed",
        metric: added[matchIdx].metric,
        whenCondition: added[matchIdx].whenCondition,
      });
    } else {
      result.push(removedEntry);
    }
  }

  for (let i = 0; i < added.length; i++) {
    if (!consumed.has(i)) {
      result.push(added[i]);
    }
  }

  return [...passThrough, ...result];
}

export interface InstrumentationDiff {
  id: string;
  displayName: string;
  status: "added" | "removed" | "changed" | "unchanged";
  telemetryDiff: TelemetryDiffResult;
  configDiff?: {
    added: string[];
    removed: string[];
    changed: string[];
  };
}

export interface ReleaseDiff {
  fromVersion: string;
  toVersion: string;
  instrumentations: InstrumentationDiff[];
  aggregateMetrics: {
    name: string;
    description: string;
    emittedBy: string[];
  }[];
  totals: {
    added: number;
    removed: number;
    changed: number;
  };
}

/**
 * Compares two Java Agent releases to identify added, removed, and changed instrumentation modules.
 * It also computes aggregate metrics for the target release.
 *
 * @param fromVersion The base version for comparison
 * @param toVersion The target version for comparison
 * @param fromData Instrumentation data for the base version
 * @param toData Instrumentation data for the target version
 * @returns A ReleaseDiff object containing the comparison results
 */
export function compareReleases(
  fromVersion: string,
  toVersion: string,
  fromData: InstrumentationData[] = [],
  toData: InstrumentationData[] = []
): ReleaseDiff {
  const safeFromData = fromData || [];
  const safeToData = toData || [];
  const fromMap = new Map(safeFromData.map((d) => [d.name, d]));
  const toMap = new Map(safeToData.map((d) => [d.name, d]));

  const allNames = Array.from(new Set([...fromMap.keys(), ...toMap.keys()])).sort();
  const instrumentations: InstrumentationDiff[] = [];

  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const name of allNames) {
    const fromInstr = fromMap.get(name);
    const toInstr = toMap.get(name);

    if (!fromInstr && toInstr) {
      added++;
      const whens = getAvailableWhenConditions(null, toInstr);
      const metrics: MetricDiff[] = [];
      const spans: SpanDiff[] = [];
      for (const w of whens) {
        const d = compareTelemetry(null, toInstr, w);
        metrics.push(...d.metrics);
        spans.push(...d.spans);
      }
      const telemetryDiff = { metrics, spans };

      const configAdded = (toInstr.configurations || []).map((c) => c.name);
      instrumentations.push({
        id: name,
        displayName: toInstr.display_name || name,
        status: "added",
        telemetryDiff,
        configDiff: {
          added: configAdded,
          removed: [],
          changed: [],
        },
      });
    } else if (fromInstr && !toInstr) {
      removed++;
      const whens = getAvailableWhenConditions(fromInstr, null);
      const metrics: MetricDiff[] = [];
      const spans: SpanDiff[] = [];
      for (const w of whens) {
        const d = compareTelemetry(fromInstr, null, w);
        metrics.push(...d.metrics);
        spans.push(...d.spans);
      }
      const telemetryDiff = { metrics, spans };

      const configRemoved = (fromInstr.configurations || []).map((c) => c.name);
      instrumentations.push({
        id: name,
        displayName: fromInstr.display_name || name,
        status: "removed",
        telemetryDiff,
        configDiff: {
          added: [],
          removed: configRemoved,
          changed: [],
        },
      });
    } else if (fromInstr && toInstr) {
      const whens = getAvailableWhenConditions(fromInstr, toInstr);
      const metrics: MetricDiff[] = [];
      const spans: SpanDiff[] = [];
      for (const w of whens) {
        const d = compareTelemetry(fromInstr, toInstr, w);
        metrics.push(...d.metrics.map((m) => ({ ...m, whenCondition: w })));
        spans.push(...d.spans.map((s) => ({ ...s, whenCondition: w })));
      }
      const telemetryDiff = {
        metrics: deduplicateMetricDiffs(metrics),
        spans: deduplicateSpanDiffs(spans),
      };

      const fromConfigs = new Map((fromInstr.configurations || []).map((c) => [c.name, c]));
      const toConfigs = new Map((toInstr.configurations || []).map((c) => [c.name, c]));

      const configAdded: string[] = [];
      const configRemoved: string[] = [];
      const configChanged: string[] = [];

      for (const [configName, config] of toConfigs) {
        if (!fromConfigs.has(configName)) {
          configAdded.push(configName);
        } else {
          const fromConfig = fromConfigs.get(configName);
          if (
            fromConfig?.description !== config.description ||
            fromConfig?.type !== config.type ||
            fromConfig?.default !== config.default ||
            fromConfig?.declarative_name !== config.declarative_name ||
            JSON.stringify(fromConfig?.examples?.slice().sort()) !==
              JSON.stringify(config.examples?.slice().sort())
          ) {
            configChanged.push(configName);
          }
        }
      }

      for (const name of fromConfigs.keys()) {
        if (!toConfigs.has(name)) {
          configRemoved.push(name);
        }
      }

      const isConfigChanged =
        configAdded.length > 0 || configRemoved.length > 0 || configChanged.length > 0;

      const isTelemetryChanged =
        telemetryDiff.metrics.some((m) => m.status !== "unchanged") ||
        telemetryDiff.spans.some((s) => s.status !== "unchanged");

      const isChanged = isTelemetryChanged || isConfigChanged;

      if (isChanged) {
        changed++;
      }

      instrumentations.push({
        id: name,
        displayName: toInstr.display_name || name,
        status: isChanged ? "changed" : "unchanged",
        telemetryDiff,
        configDiff: {
          added: configAdded,
          removed: configRemoved,
          changed: configChanged,
        },
      });
    }
  }

  const metricToInstrumentations = new Map<string, { description: string; emittedBy: string[] }>();
  for (const instr of safeToData) {
    if (instr.telemetry) {
      for (const telemetry of instr.telemetry) {
        if (telemetry.metrics) {
          for (const metric of telemetry.metrics) {
            const existing = metricToInstrumentations.get(metric.name) || {
              description: metric.description,
              emittedBy: [],
            };
            if (!existing.emittedBy.includes(instr.display_name || instr.name)) {
              existing.emittedBy.push(instr.display_name || instr.name);
            }
            metricToInstrumentations.set(metric.name, existing);
          }
        }
      }
    }
  }

  const aggregateMetrics = Array.from(metricToInstrumentations.entries())
    .map(([name, data]) => ({
      name,
      description: data.description,
      emittedBy: data.emittedBy.sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    fromVersion,
    toVersion,
    instrumentations,
    aggregateMetrics,
    totals: { added, removed, changed },
  };
}
