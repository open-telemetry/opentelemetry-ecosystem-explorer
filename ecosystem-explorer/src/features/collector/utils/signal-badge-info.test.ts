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
import { getPresentSignals } from "./signal-badge-info";

describe("getPresentSignals", () => {
  it("returns an empty array when signals is missing", () => {
    expect(getPresentSignals({})).toEqual([]);
  });

  it("returns an empty array when signals is empty", () => {
    expect(getPresentSignals({ signals: [] })).toEqual([]);
  });

  it("returns a single signal", () => {
    expect(getPresentSignals({ signals: ["metrics"] })).toEqual(["metrics"]);
  });

  it("orders signals as metrics, traces, logs, profiles regardless of input order", () => {
    expect(getPresentSignals({ signals: ["profiles", "logs", "traces", "metrics"] })).toEqual([
      "metrics",
      "traces",
      "logs",
      "profiles",
    ]);
  });

  it("ignores unrecognized signal names", () => {
    expect(getPresentSignals({ signals: ["metrics", "baggage"] })).toEqual(["metrics"]);
  });
});
