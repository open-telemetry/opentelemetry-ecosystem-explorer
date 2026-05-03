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
import { compareReleases } from "./release-diff";
import type { InstrumentationData } from "@/types/javaagent";

describe("release-diff utility", () => {
  const mockInstrumentation = (
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metrics: any[] = [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spans: any[] = []
  ): InstrumentationData => ({
    name,
    display_name: `${name} Display`,
    scope: { name: "test" },
    telemetry: [
      {
        when: "default",
        metrics,
        spans,
      },
    ],
  });

  it("should detect added, removed and changed instrumentations", () => {
    const fromData: InstrumentationData[] = [
      mockInstrumentation("instr1", [{ name: "metric1" }]),
      mockInstrumentation("instr2"),
    ];

    const toData: InstrumentationData[] = [
      mockInstrumentation("instr1", [{ name: "metric1" }, { name: "metric2" }]),
      mockInstrumentation("instr3"),
    ];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    expect(diff.totals.added).toBe(1);
    expect(diff.totals.removed).toBe(1);
    expect(diff.totals.changed).toBe(1);

    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.status).toBe("changed");

    const instr2 = diff.instrumentations.find((i) => i.id === "instr2");
    expect(instr2?.status).toBe("removed");

    const instr3 = diff.instrumentations.find((i) => i.id === "instr3");
    expect(instr3?.status).toBe("added");
  });

  it("should handle identical instrumentations as unchanged", () => {
    const fromData: InstrumentationData[] = [mockInstrumentation("instr1")];
    const toData: InstrumentationData[] = [mockInstrumentation("instr1")];

    const diff = compareReleases("1.0.0", "1.1.0", fromData, toData);

    expect(diff.totals.added).toBe(0);
    expect(diff.totals.removed).toBe(0);
    expect(diff.totals.changed).toBe(0);

    const instr1 = diff.instrumentations.find((i) => i.id === "instr1");
    expect(instr1?.status).toBe("unchanged");
  });
});
