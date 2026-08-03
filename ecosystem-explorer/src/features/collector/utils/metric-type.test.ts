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
import { describe, it, expect } from "vitest";
import { getMetricType } from "./metric-type";
import type { CollectorMetric } from "@/types/collector";

function makeMetric(overrides: Partial<CollectorMetric> = {}): CollectorMetric {
  return { description: "d", enabled: true, unit: "1", ...overrides };
}

describe("getMetricType", () => {
  it("returns 'sum' when the metric has a sum descriptor", () => {
    expect(getMetricType(makeMetric({ sum: { value_type: "int", monotonic: true } }))).toBe("sum");
  });

  it("returns 'gauge' when the metric has a gauge descriptor", () => {
    expect(getMetricType(makeMetric({ gauge: { value_type: "double" } }))).toBe("gauge");
  });

  it("returns 'histogram' when the metric has a histogram descriptor", () => {
    expect(getMetricType(makeMetric({ histogram: { value_type: "int" } }))).toBe("histogram");
  });

  it("returns null when no descriptor is present", () => {
    expect(getMetricType(makeMetric())).toBeNull();
  });
});
