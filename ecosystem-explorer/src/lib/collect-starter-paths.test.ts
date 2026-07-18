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
import { collectStarterPaths } from "./collect-starter-paths";

describe("collectStarterPaths", () => {
  it("includes every key present in the starter, even when its subtree is empty", () => {
    const paths = collectStarterPaths({
      tracer_provider: { processors: [{ batch: { exporter: { otlp_http: {} } } }] },
      meter_provider: {},
      propagator: { composite: [{ tracecontext: {} }, { baggage: {} }] },
    });
    expect(paths.has("tracer_provider")).toBe(true);
    expect(paths.has("tracer_provider.processors")).toBe(true);
    expect(paths.has("meter_provider")).toBe(true);
    expect(paths.has("propagator")).toBe(true);
    expect(paths.has("propagator.composite")).toBe(true);
  });

  it("does not recurse into arrays — array indices are not path segments", () => {
    const paths = collectStarterPaths({
      propagator: { composite: [{ tracecontext: {} }] },
    });
    expect(paths.has("propagator.composite.0")).toBe(false);
  });

  it("ignores undefined values", () => {
    const paths = collectStarterPaths({ a: undefined, b: { c: 1 } } as Record<string, unknown>);
    expect(paths.has("a")).toBe(false);
    expect(paths.has("b")).toBe(true);
    expect(paths.has("b.c")).toBe(true);
  });

  it("returns an empty set for empty input", () => {
    expect(collectStarterPaths({}).size).toBe(0);
  });
});
