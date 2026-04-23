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
  Telemetry,
  Metric,
  Span,
  Attribute,
  TelemetryDiffResult,
  MetricDiff,
  SpanDiff,
  AttributeChange,
  AttributeChanges,
  MetricChanges,
  SpanChanges,
} from "@/types/javaagent";

export function getTelemetryForCondition(
  instrumentation: InstrumentationData | null,
  when: string
): Telemetry | null {
  if (!instrumentation?.telemetry) return null;
  return instrumentation.telemetry.find((t) => t.when === when) ?? null;
}

export function getDefaultTelemetry(instrumentation: InstrumentationData | null): Telemetry | null {
  return getTelemetryForCondition(instrumentation, "default");
}

export function getAvailableWhenConditions(
  base: InstrumentationData | null,
  comparison: InstrumentationData | null
): string[] {
  const baseWhens = base?.telemetry?.map((t) => t.when) ?? [];
  const comparisonWhens = comparison?.telemetry?.map((t) => t.when) ?? [];
  const unique = Array.from(new Set([...baseWhens, ...comparisonWhens]));
  return unique.sort((a, b) => {
    if (a === "default") return -1;
    if (b === "default") return 1;
    return a.localeCompare(b);
  });
}

/**
 * Compare two sets of attributes by name
 */
function compareAttributes(
  baseAttrs: Attribute[] = [],
  comparisonAttrs: Attribute[] = []
): AttributeChanges {
  const baseMap = new Map(baseAttrs.map((a) => [a.name, a]));
  const comparisonMap = new Map(comparisonAttrs.map((a) => [a.name, a]));

  const added: Attribute[] = [];
  const removed: Attribute[] = [];
  const changed: AttributeChange[] = [];

  // Find added attributes
  for (const attr of comparisonAttrs) {
    if (!baseMap.has(attr.name)) {
      added.push(attr);
    }
  }

  // Find removed attributes and check for type changes
  for (const attr of baseAttrs) {
    const comparisonAttr = comparisonMap.get(attr.name);
    if (!comparisonAttr) {
      removed.push(attr);
    } else if (attr.type !== comparisonAttr.type) {
      changed.push({
        name: attr.name,
        before: attr,
        after: comparisonAttr,
      });
    }
  }

  return { added, removed, changed };
}

/**
 * Compare two metrics
 */
function compareMetrics(
  baseMetrics: Metric[] = [],
  comparisonMetrics: Metric[] = []
): MetricDiff[] {
  const baseMap = new Map(baseMetrics.map((m) => [m.name, m]));
  const comparisonMap = new Map(comparisonMetrics.map((m) => [m.name, m]));
  const diffs: MetricDiff[] = [];

  // Process all metrics from both versions
  const allNames = new Set([...baseMap.keys(), ...comparisonMap.keys()]);

  for (const name of allNames) {
    const baseMetric = baseMap.get(name);
    const comparisonMetric = comparisonMap.get(name);

    if (!baseMetric && comparisonMetric) {
      // Added metric
      diffs.push({
        status: "added",
        metric: comparisonMetric,
      });
    } else if (baseMetric && !comparisonMetric) {
      // Removed metric
      diffs.push({
        status: "removed",
        metric: baseMetric,
      });
    } else if (baseMetric && comparisonMetric) {
      // Check if metric changed
      const attributeChanges = compareAttributes(
        baseMetric.attributes ?? [],
        comparisonMetric.attributes ?? []
      );

      const descriptionChanged = baseMetric.description !== comparisonMetric.description;
      const dataTypeChanged = baseMetric.data_type !== comparisonMetric.data_type;
      const unitChanged = baseMetric.unit !== comparisonMetric.unit;
      const instrumentChanged = baseMetric.instrument !== comparisonMetric.instrument;
      const attributesChanged =
        attributeChanges.added.length > 0 ||
        attributeChanges.removed.length > 0 ||
        attributeChanges.changed.length > 0;

      if (
        descriptionChanged ||
        dataTypeChanged ||
        unitChanged ||
        instrumentChanged ||
        attributesChanged
      ) {
        const changes: MetricChanges = {
          attributes: attributeChanges,
        };

        if (descriptionChanged) {
          changes.description = {
            before: baseMetric.description,
            after: comparisonMetric.description,
          };
        }

        if (dataTypeChanged) {
          changes.data_type = {
            before: baseMetric.data_type,
            after: comparisonMetric.data_type,
          };
        }

        if (unitChanged) {
          changes.unit = {
            before: baseMetric.unit,
            after: comparisonMetric.unit,
          };
        }

        if (instrumentChanged) {
          changes.instrument = {
            before: baseMetric.instrument,
            after: comparisonMetric.instrument,
          };
        }

        diffs.push({
          status: "changed",
          metric: comparisonMetric,
          changes,
        });
      } else {
        diffs.push({
          status: "unchanged",
          metric: comparisonMetric,
        });
      }
    }
  }

  return diffs;
}

/**
 * Compare two spans
 */
function compareSpans(baseSpans: Span[] = [], comparisonSpans: Span[] = []): SpanDiff[] {
  const diffs: SpanDiff[] = [];

  // Group spans by span_kind for comparison
  const baseByKind = new Map<string, Span[]>();
  const comparisonByKind = new Map<string, Span[]>();

  for (const span of baseSpans) {
    const existing = baseByKind.get(span.span_kind) || [];
    baseByKind.set(span.span_kind, [...existing, span]);
  }

  for (const span of comparisonSpans) {
    const existing = comparisonByKind.get(span.span_kind) || [];
    comparisonByKind.set(span.span_kind, [...existing, span]);
  }

  const allKinds = new Set([...baseByKind.keys(), ...comparisonByKind.keys()]);

  for (const kind of allKinds) {
    const baseSpansOfKind = baseByKind.get(kind) || [];
    const comparisonSpansOfKind = comparisonByKind.get(kind) || [];

    // Compare same-indexed spans of the same kind
    const maxLength = Math.max(baseSpansOfKind.length, comparisonSpansOfKind.length);

    for (let i = 0; i < maxLength; i++) {
      const baseSpan = baseSpansOfKind[i];
      const comparisonSpan = comparisonSpansOfKind[i];

      if (!baseSpan && comparisonSpan) {
        // Added span
        diffs.push({
          status: "added",
          span: comparisonSpan,
        });
      } else if (baseSpan && !comparisonSpan) {
        // Removed span
        diffs.push({
          status: "removed",
          span: baseSpan,
        });
      } else if (baseSpan && comparisonSpan) {
        // Check if span changed
        const attributeChanges = compareAttributes(
          baseSpan.attributes ?? [],
          comparisonSpan.attributes ?? []
        );

        const attributesChanged =
          attributeChanges.added.length > 0 ||
          attributeChanges.removed.length > 0 ||
          attributeChanges.changed.length > 0;

        if (attributesChanged) {
          const changes: SpanChanges = {
            attributes: attributeChanges,
          };

          diffs.push({
            status: "changed",
            span: comparisonSpan,
            changes,
          });
        } else {
          diffs.push({
            status: "unchanged",
            span: comparisonSpan,
          });
        }
      }
    }
  }

  return diffs;
}

export function compareTelemetry(
  baseInstrumentation: InstrumentationData | null,
  comparisonInstrumentation: InstrumentationData | null,
  when: string = "default"
): TelemetryDiffResult {
  const baseTelemetry = getTelemetryForCondition(baseInstrumentation, when);
  const comparisonTelemetry = getTelemetryForCondition(comparisonInstrumentation, when);

  const metrics = compareMetrics(baseTelemetry?.metrics ?? [], comparisonTelemetry?.metrics ?? []);
  const spans = compareSpans(baseTelemetry?.spans ?? [], comparisonTelemetry?.spans ?? []);

  return { metrics, spans };
}
