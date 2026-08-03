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
  CollectorComponent,
  CollectorMetric,
  CollectorMetricChanges,
  CollectorMetricDiff,
  CollectorTelemetryDiffResult,
} from "@/types/collector";
import { getMetricType } from "./metric-type";

function diffAttributes(
  before: string[] = [],
  after: string[] = []
): { added: string[]; removed: string[] } | undefined {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added = after.filter((a) => !beforeSet.has(a));
  const removed = before.filter((a) => !afterSet.has(a));
  if (added.length === 0 && removed.length === 0) return undefined;
  return { added, removed };
}

/**
 * Compares two versions of the same metric. Returns undefined when nothing
 * observable changed. There is no `when`-condition axis to consider here:
 * unlike Java Agent instrumentation telemetry, Collector metadata has no
 * configuration-dependent variants of a metric.
 */
function compareMetric(
  before: CollectorMetric,
  after: CollectorMetric
): CollectorMetricChanges | undefined {
  const changes: CollectorMetricChanges = {};

  if (before.description !== after.description) {
    changes.description = { before: before.description, after: after.description };
  }

  if (before.unit !== after.unit) {
    changes.unit = { before: before.unit, after: after.unit };
  }

  if (before.enabled !== after.enabled) {
    changes.enabled = { before: before.enabled, after: after.enabled };
  }

  if (before.stability !== after.stability) {
    changes.stability = { before: before.stability, after: after.stability };
  }

  const beforeType = getMetricType(before);
  const afterType = getMetricType(after);
  if (beforeType !== afterType) {
    changes.type = { before: beforeType, after: afterType };
  }

  const attributeChanges = diffAttributes(before.attributes, after.attributes);
  if (attributeChanges) {
    changes.attributes = attributeChanges;
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
}

/**
 * Compares the internal self-observability `telemetry.metrics` of two
 * versions of the same Collector component. Either component may be null
 * (component missing/failed to load in one version), in which case every
 * metric on the other side is reported as fully added or removed.
 */
export function compareTelemetryMetrics(
  fromComponent: CollectorComponent | null,
  toComponent: CollectorComponent | null
): CollectorTelemetryDiffResult {
  const fromMetrics = fromComponent?.telemetry?.metrics ?? {};
  const toMetrics = toComponent?.telemetry?.metrics ?? {};

  const allNames = Array.from(
    new Set([...Object.keys(fromMetrics), ...Object.keys(toMetrics)])
  ).sort();

  const metrics: CollectorMetricDiff[] = [];

  for (const name of allNames) {
    const before = fromMetrics[name];
    const after = toMetrics[name];

    if (!before && after) {
      metrics.push({ status: "added", name, metric: after });
    } else if (before && !after) {
      metrics.push({ status: "removed", name, metric: before });
    } else if (before && after) {
      const changes = compareMetric(before, after);
      if (changes) {
        metrics.push({ status: "changed", name, metric: after, changes });
      } else {
        metrics.push({ status: "unchanged", name, metric: after });
      }
    }
  }

  return { metrics };
}
