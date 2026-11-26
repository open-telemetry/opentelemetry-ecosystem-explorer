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
import { describe, it, expect } from "vite-plus/test";
import { metricsTone, semconvTone, toneClasses } from "./filter-styles";

describe("python filter styles", () => {
  it("gives each metrics value its own colour, so unknown never looks like no", () => {
    const badges = (["supported", "unsupported", "unknown"] as const).map(
      (m) => metricsTone(m).badge
    );
    expect(new Set(badges).size).toBe(3);
    expect(metricsTone("supported").badge).toContain("green");
    expect(metricsTone("unsupported").badge).toContain("amber");
    expect(metricsTone("unknown").badge).toContain("slate");
  });

  it("colours semantic-convention status by value, with unknown neutral", () => {
    expect(semconvTone("migration").badge).toContain("purple");
    expect(semconvTone("unknown").badge).toContain("slate");
    // A status upstream adds later still gets a colour rather than none.
    expect(semconvTone("something-new").badge).toContain("blue");
  });

  it("uses the same neutral for unknown in both facets", () => {
    expect(semconvTone("unknown")).toBe(metricsTone("unknown"));
  });

  it("switches between the active and inactive classes", () => {
    const tone = metricsTone("supported");
    expect(toneClasses(tone, true)).toBe(tone.active);
    expect(toneClasses(tone, false)).toBe(tone.inactive);
    expect(tone.active).not.toBe(tone.inactive);
  });

  it("provides a swatch colour for every tone", () => {
    for (const tone of [
      metricsTone("supported"),
      metricsTone("unsupported"),
      semconvTone("migration"),
    ]) {
      expect(tone.swatch).toMatch(/^hsl\(/);
    }
  });
});
