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
  AttributeChanges,
  MetricChanges,
  SpanChanges,
} from "@/types/javaagent";

/**
 * Extract default telemetry (when === "default") from instrumentation data
 */
export function getDefaultTelemetry(instrumentation: InstrumentationData | null): Telemetry | null {
  if (!instrumentation?.telemetry) return null;
  return instrumentation.telemetry.find((t) => t.when === "default") || null;
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

  // Find added attributes
  for (const attr of comparisonAttrs) {
    if (!baseMap.has(attr.name)) {
      added.push(attr);
    }
  }

  // Find removed attributes
  for (const attr of baseAttrs) {
    if (!comparisonMap.has(attr.name)) {
      removed.push(attr);
    }
  }

  return { added, removed };
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
      const attributesChanged =
        attributeChanges.added.length > 0 || attributeChanges.removed.length > 0;

      if (descriptionChanged || dataTypeChanged || unitChanged || attributesChanged) {
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
          attributeChanges.added.length > 0 || attributeChanges.removed.length > 0;

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

/**
 * Main comparison function
 */
export function compareTelemetry(
  baseInstrumentation: InstrumentationData | null,
  comparisonInstrumentation: InstrumentationData | null
): TelemetryDiffResult {
  const baseTelemetry = getDefaultTelemetry(baseInstrumentation);
  const comparisonTelemetry = getDefaultTelemetry(comparisonInstrumentation);

  const metrics = compareMetrics(
    baseTelemetry?.metrics ?? [],
    comparisonTelemetry?.metrics ?? []
  );
  const spans = compareSpans(baseTelemetry?.spans ?? [], comparisonTelemetry?.spans ?? []);

  return { metrics, spans };
}
