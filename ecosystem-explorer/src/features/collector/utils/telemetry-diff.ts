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
  CollectorMetricDescriptorChanges,
  CollectorMetricDiff,
  CollectorMetricWarnings,
  CollectorTelemetryDiffResult,
  MetricValueDescriptor,
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

/**
 * Merges a version's component-level attribute maps the same way the current view resolves
 * them (collector-telemetry-tab.tsx: `attributes?.[key] ?? resourceAttributes?.[key]`), so a
 * key defined only in `resource_attributes` isn't treated as missing/removed during comparison.
 * `attributes` takes precedence over `resource_attributes` for the same key. Never mutates
 * either input map.
 */
function mergeAttributeMaps(
  attributes: Record<string, CollectorAttribute> | undefined,
  resourceAttributes: Record<string, CollectorAttribute> | undefined
): Record<string, CollectorAttribute> {
  return { ...resourceAttributes, ...attributes };
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

function numberArraysEqual(a: number[] | undefined, b: number[] | undefined): boolean {
  const aArr = a ?? [];
  const bArr = b ?? [];
  return aArr.length === bArr.length && aArr.every((v, i) => v === bArr[i]);
}

/**
 * Compares a metric's instrument type and, when the type is unchanged, its type-specific
 * descriptor (sum/gauge/histogram) field-by-field. Returns at most one of `metricType` (the
 * instrument type itself changed, e.g. sum -> gauge) or `descriptor` (same type, but one or
 * more descriptor fields differ) so a descriptor-only change never gets misreported as a
 * "type changed" (e.g. "sum -> sum").
 */
function compareMetricDescriptor(
  from: CollectorMetric,
  to: CollectorMetric
): Pick<CollectorMetricChanges, "metricType" | "descriptor"> {
  const fromType = getMetricType(from);
  const toType = getMetricType(to);

  if (fromType !== toType) {
    return { metricType: { before: fromType, after: toType } };
  }
  if (fromType === null) {
    return {};
  }

  const fromDescriptor = from[fromType] as MetricValueDescriptor & {
    monotonic?: boolean;
    bucket_boundaries?: number[];
  };
  const toDescriptor = to[fromType] as MetricValueDescriptor & {
    monotonic?: boolean;
    bucket_boundaries?: number[];
  };

  const descriptor: CollectorMetricDescriptorChanges = {};

  if (fromDescriptor.value_type !== toDescriptor.value_type) {
    descriptor.value_type = { before: fromDescriptor.value_type, after: toDescriptor.value_type };
  }
  if (fromDescriptor.aggregation_temporality !== toDescriptor.aggregation_temporality) {
    descriptor.aggregation_temporality = {
      before: fromDescriptor.aggregation_temporality,
      after: toDescriptor.aggregation_temporality,
    };
  }
  if (fromDescriptor.async !== toDescriptor.async) {
    descriptor.async = { before: fromDescriptor.async, after: toDescriptor.async };
  }
  if (fromType === "sum" && fromDescriptor.monotonic !== toDescriptor.monotonic) {
    descriptor.monotonic = { before: fromDescriptor.monotonic, after: toDescriptor.monotonic };
  }
  if (
    fromType === "histogram" &&
    !numberArraysEqual(fromDescriptor.bucket_boundaries, toDescriptor.bucket_boundaries)
  ) {
    descriptor.bucket_boundaries = {
      before: fromDescriptor.bucket_boundaries,
      after: toDescriptor.bucket_boundaries,
    };
  }

  return Object.keys(descriptor).length > 0 ? { descriptor } : {};
}

function deprecatedEqual(
  a?: { note?: string; since?: string },
  b?: { note?: string; since?: string }
): boolean {
  if (!a || !b) return a === b;
  return a.note === b.note && a.since === b.since;
}

/**
 * Compares the union of keys actually present on either side, rather than a fixed list of
 * known field names, so a warning field neither side happens to omit -- including one added
 * upstream after this type was last updated -- is never silently skipped.
 */
function warningsEqual(a?: CollectorMetricWarnings, b?: CollectorMetricWarnings): boolean {
  if (!a || !b) return a === b;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<
    keyof CollectorMetricWarnings
  >;
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
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
  const extendedDocumentationChanged =
    fromMetric.extended_documentation !== toMetric.extended_documentation;
  const optionalChanged = fromMetric.optional !== toMetric.optional;
  const prefixChanged = fromMetric.prefix !== toMetric.prefix;
  const deprecatedChanged = !deprecatedEqual(fromMetric.deprecated, toMetric.deprecated);
  const warningsChanged = !warningsEqual(fromMetric.warnings, toMetric.warnings);
  const descriptorChanges = compareMetricDescriptor(fromMetric, toMetric);
  const descriptorChanged =
    descriptorChanges.metricType !== undefined || descriptorChanges.descriptor !== undefined;

  if (
    !descriptionChanged &&
    !unitChanged &&
    !enabledChanged &&
    !stabilityChanged &&
    !extendedDocumentationChanged &&
    !optionalChanged &&
    !prefixChanged &&
    !deprecatedChanged &&
    !warningsChanged &&
    !descriptorChanged &&
    !attributesChanged
  ) {
    return { status: "unchanged", name, metric: toMetric };
  }

  const changes: CollectorMetricChanges = { attributes: attributeChanges, ...descriptorChanges };

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
  if (extendedDocumentationChanged) {
    changes.extendedDocumentation = {
      before: fromMetric.extended_documentation,
      after: toMetric.extended_documentation,
    };
  }
  if (optionalChanged) {
    changes.optional = { before: fromMetric.optional, after: toMetric.optional };
  }
  if (prefixChanged) {
    changes.prefix = { before: fromMetric.prefix, after: toMetric.prefix };
  }
  if (deprecatedChanged) {
    changes.deprecated = { before: fromMetric.deprecated, after: toMetric.deprecated };
  }
  if (warningsChanged) {
    changes.warnings = { before: fromMetric.warnings, after: toMetric.warnings };
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
  const fromAttributes = mergeAttributeMaps(
    fromComponent?.attributes,
    fromComponent?.resource_attributes
  );
  const toAttributes = mergeAttributeMaps(
    toComponent?.attributes,
    toComponent?.resource_attributes
  );

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
