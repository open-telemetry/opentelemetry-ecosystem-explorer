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

import { describe, expect, it } from "vitest";

import type { IndexComponent } from "@/types/collector";
import { toCollectorResult } from "./collector";

function makeComponent(overrides: Partial<IndexComponent> = {}): IndexComponent {
  return {
    id: "core-receiver-otlp",
    name: "otlp",
    distribution: "core",
    type: "receiver",
    display_name: "OTLP Receiver",
    description: "Receives telemetry over OTLP",
    stability: "stable",
    ...overrides,
  };
}

describe("toCollectorResult", () => {
  it("maps a component to a collector search result with a type facet", () => {
    const result = toCollectorResult(makeComponent(), "2.0.0");

    expect(result).toMatchObject({
      title: "OTLP Receiver",
      path: "/collector/components/core/otlp?version=2.0.0",
      type: "item",
      ecosystem: "collector",
      facets: ["receiver"],
      stability: "stable",
      version: "2.0.0",
    });
    expect(result.keywords).toEqual(["core-receiver-otlp", "otlp", "core", "receiver"]);
  });

  it("returns undefined stability when the index omits it", () => {
    const result = toCollectorResult(makeComponent({ stability: null }), "2.0.0");

    expect(result.stability).toBeUndefined();
  });

  it("falls back to the component name when display_name is absent", () => {
    const result = toCollectorResult(
      makeComponent({ display_name: null, name: "zipkin" }),
      "2.0.0"
    );

    expect(result.title).toBe("zipkin");
  });
});
