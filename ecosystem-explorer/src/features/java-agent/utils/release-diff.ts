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

import type { InstrumentationData, TelemetryDiffResult } from "@/types/javaagent";
import { compareTelemetry } from "./telemetry-diff";

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
  fromData: InstrumentationData[],
  toData: InstrumentationData[]
): ReleaseDiff {
  const fromMap = new Map(fromData.map((d) => [d.name, d]));
  const toMap = new Map(toData.map((d) => [d.name, d]));

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
      instrumentations.push({
        id: name,
        displayName: toInstr.display_name || name,
        status: "added",
        telemetryDiff: compareTelemetry(null, toInstr),
      });
    } else if (fromInstr && !toInstr) {
      removed++;
      instrumentations.push({
        id: name,
        displayName: fromInstr.display_name || name,
        status: "removed",
        telemetryDiff: compareTelemetry(fromInstr, null),
      });
    } else if (fromInstr && toInstr) {
      const telemetryDiff = compareTelemetry(fromInstr, toInstr);

      const fromConfigs = new Map((fromInstr.configurations || []).map((c) => [c.name, c]));
      const toConfigs = new Map((toInstr.configurations || []).map((c) => [c.name, c]));

      const configAdded: string[] = [];
      const configRemoved: string[] = [];
      const configChanged: string[] = [];

      for (const [name, config] of toConfigs) {
        if (!fromConfigs.has(name)) {
          configAdded.push(name);
        } else {
          const fromConfig = fromConfigs.get(name);
          if (
            fromConfig?.description !== config.description ||
            fromConfig?.type !== config.type ||
            fromConfig?.default !== config.default
          ) {
            configChanged.push(name);
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
  for (const instr of toData) {
    const defaultTelemetry = instr.telemetry?.find((t) => t.when === "default");
    if (defaultTelemetry?.metrics) {
      for (const metric of defaultTelemetry.metrics) {
        const existing = metricToInstrumentations.get(metric.name) || {
          description: metric.description,
          emittedBy: [],
        };
        existing.emittedBy.push(instr.display_name || instr.name);
        metricToInstrumentations.set(metric.name, existing);
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
