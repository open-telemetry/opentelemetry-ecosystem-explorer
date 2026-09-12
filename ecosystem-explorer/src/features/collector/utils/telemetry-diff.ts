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
  CollectorAttribute,
  CollectorAttributeChange,
  CollectorAttributeChanges,
  CollectorComponent,
  CollectorMetric,
  CollectorMetricChanges,
  CollectorMetricDiff,
  CollectorTelemetryDiffResult,
  ResolvedCollectorAttribute,
} from "@/types/collector";
import { getMetricType } from "./metric-type";

function attributesEqual(a?: CollectorAttribute, b?: CollectorAttribute): boolean {
  if (!a || !b) return a === b;
  return (
    a.type === b.type &&
    a.description === b.description &&
    a.name_override === b.name_override &&
    JSON.stringify(a.enum ?? []) === JSON.stringify(b.enum ?? [])
  );
}

/** Resolves a metric's attribute key references against a version's component-level attributes map. */
function resolveAttributes(
  metric: CollectorMetric,
  attributesMap: Record<string, CollectorAttribute> | undefined
): ResolvedCollectorAttribute[] {
  return (metric.attributes ?? []).map((key) => ({ key, definition: attributesMap?.[key] }));
}

/**
 * Compares the attribute keys a metric references (resolved against each version's own
 * component-level attributes map) between two versions of the same metric.
 */
function compareAttributes(
  fromMetric: CollectorMetric,
  toMetric: CollectorMetric,
  fromAttributes: Record<string, CollectorAttribute> | undefined,
  toAttributes: Record<string, CollectorAttribute> | undefined
): CollectorAttributeChanges {
  const fromResolved = resolveAttributes(fromMetric, fromAttributes);
  const toResolved = resolveAttributes(toMetric, toAttributes);
  const fromMap = new Map(fromResolved.map((a) => [a.key, a]));
  const toMap = new Map(toResolved.map((a) => [a.key, a]));

  const added: ResolvedCollectorAttribute[] = [];
  const removed: ResolvedCollectorAttribute[] = [];
  const changed: CollectorAttributeChange[] = [];

  for (const attr of toResolved) {
    if (!fromMap.has(attr.key)) {
      added.push(attr);
    }
  }

  for (const attr of fromResolved) {
    const toAttr = toMap.get(attr.key);
    if (!toAttr) {
      removed.push(attr);
    } else if (!attributesEqual(attr.definition, toAttr.definition)) {
      changed.push({ key: attr.key, before: attr.definition, after: toAttr.definition });
    }
  }

  return { added, removed, changed };
}

/** Shallow-compares the type-specific descriptor (sum/gauge/histogram) of a metric. */
function metricDescriptorEqual(from: CollectorMetric, to: CollectorMetric): boolean {
  const fromType = getMetricType(from);
  const toType = getMetricType(to);
  if (fromType !== toType) return false;
  if (fromType === null) return true;

  const fromDescriptor = from[fromType];
  const toDescriptor = to[toType as "sum" | "gauge" | "histogram"];
  return JSON.stringify(fromDescriptor) === JSON.stringify(toDescriptor);
}

/** Compares one metric present in both versions, keyed by `name`. */
function compareMetric(
  name: string,
  fromMetric: CollectorMetric,
  toMetric: CollectorMetric,
  fromAttributes: Record<string, CollectorAttribute> | undefined,
  toAttributes: Record<string, CollectorAttribute> | undefined
): CollectorMetricDiff {
  const attributeChanges = compareAttributes(fromMetric, toMetric, fromAttributes, toAttributes);
  const attributesChanged =
    attributeChanges.added.length > 0 ||
    attributeChanges.removed.length > 0 ||
    attributeChanges.changed.length > 0;

  const descriptionChanged = fromMetric.description !== toMetric.description;
  const unitChanged = fromMetric.unit !== toMetric.unit;
  const enabledChanged = fromMetric.enabled !== toMetric.enabled;
  const stabilityChanged = fromMetric.stability !== toMetric.stability;
  const metricTypeChanged = !metricDescriptorEqual(fromMetric, toMetric);

  if (
    !descriptionChanged &&
    !unitChanged &&
    !enabledChanged &&
    !stabilityChanged &&
    !metricTypeChanged &&
    !attributesChanged
  ) {
    return { status: "unchanged", name, metric: toMetric };
  }

  const changes: CollectorMetricChanges = { attributes: attributeChanges };

  if (descriptionChanged) {
    changes.description = { before: fromMetric.description, after: toMetric.description };
  }
  if (unitChanged) {
    changes.unit = { before: fromMetric.unit, after: toMetric.unit };
  }
  if (enabledChanged) {
    changes.enabled = { before: fromMetric.enabled, after: toMetric.enabled };
  }
  if (stabilityChanged) {
    changes.stability = { before: fromMetric.stability, after: toMetric.stability };
  }
  if (metricTypeChanged) {
    changes.metricType = { before: getMetricType(fromMetric), after: getMetricType(toMetric) };
  }

  return { status: "changed", name, metric: toMetric, changes };
}

/**
 * Compares the internal telemetry metrics of two versions of the same Collector component.
 * Unlike the Java Agent equivalent, there is no `when`-condition axis and no span diffing:
 * Collector internal telemetry is metrics-only and unconditional.
 */
export function compareCollectorTelemetry(
  fromComponent: CollectorComponent | null,
  toComponent: CollectorComponent | null
): CollectorTelemetryDiffResult {
  const fromMetrics = fromComponent?.telemetry?.metrics ?? {};
  const toMetrics = toComponent?.telemetry?.metrics ?? {};
  const fromAttributes = fromComponent?.attributes;
  const toAttributes = toComponent?.attributes;

  const allNames = new Set([...Object.keys(fromMetrics), ...Object.keys(toMetrics)]);
  const diffs: CollectorMetricDiff[] = [];

  for (const name of allNames) {
    const fromMetric = fromMetrics[name];
    const toMetric = toMetrics[name];

    if (!fromMetric && toMetric) {
      diffs.push({ status: "added", name, metric: toMetric });
    } else if (fromMetric && !toMetric) {
      diffs.push({ status: "removed", name, metric: fromMetric });
    } else if (fromMetric && toMetric) {
      diffs.push(compareMetric(name, fromMetric, toMetric, fromAttributes, toAttributes));
    }
  }

  diffs.sort((a, b) => a.name.localeCompare(b.name));

  return { metrics: diffs };
}
