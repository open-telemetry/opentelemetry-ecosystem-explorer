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

const baseMetric: CollectorMetric = {
  description: "A test metric",
  enabled: true,
  unit: "1",
};

describe("getMetricType", () => {
  it("returns 'sum' when the metric has a sum descriptor", () => {
    expect(getMetricType({ ...baseMetric, sum: { monotonic: true, value_type: "int" } })).toBe(
      "sum"
    );
  });

  it("returns 'gauge' when the metric has a gauge descriptor", () => {
    expect(getMetricType({ ...baseMetric, gauge: { value_type: "double" } })).toBe("gauge");
  });

  it("returns 'histogram' when the metric has a histogram descriptor", () => {
    expect(
      getMetricType({ ...baseMetric, histogram: { value_type: "int", bucket_boundaries: [1, 2] } })
    ).toBe("histogram");
  });

  it("returns null when no type-specific descriptor is present", () => {
    expect(getMetricType(baseMetric)).toBeNull();
  });

  it("prefers sum over gauge/histogram when multiple descriptors are somehow present", () => {
    expect(
      getMetricType({
        ...baseMetric,
        sum: { monotonic: true, value_type: "int" },
        gauge: { value_type: "double" },
      })
    ).toBe("sum");
  });
});
