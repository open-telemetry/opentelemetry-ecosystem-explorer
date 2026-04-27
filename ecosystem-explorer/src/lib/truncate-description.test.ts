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
import { truncateDescription } from "./truncate-description";

describe("truncateDescription", () => {
  it("returns null rest when text fits in one short sentence", () => {
    const r = truncateDescription("Configure the exporter.");
    expect(r).toEqual({ summary: "Configure the exporter.", rest: null });
  });

  it("splits at the first sentence boundary when text has multiple sentences", () => {
    const r = truncateDescription(
      "Configure loggers. Wildcards * and ? are supported. Empty matches everything."
    );
    expect(r.summary).toBe("Configure loggers.");
    expect(r.rest).toBe("Wildcards * and ? are supported. Empty matches everything.");
  });

  it("hard-caps at maxChars when the first sentence is longer", () => {
    const long =
      "Configure logger names to match, evaluated as follows: " +
      "if the logger name exactly matches, or if the logger name matches the wildcard pattern, " +
      "where ? matches any single character and * matches any number of characters including none.";
    const r = truncateDescription(long, 80);
    expect(r.summary.length).toBeLessThanOrEqual(80);
    expect(r.summary.endsWith(" ")).toBe(false);
    expect(r.rest).not.toBeNull();
    expect((r.summary + " " + r.rest).replace(/\s+/g, " ").trim()).toBe(
      long.replace(/\s+/g, " ").trim()
    );
  });

  it("returns full text and null rest when there is no terminator and text is short", () => {
    const r = truncateDescription("Configure exporter");
    expect(r).toEqual({ summary: "Configure exporter", rest: null });
  });

  it("handles empty input", () => {
    expect(truncateDescription("")).toEqual({ summary: "", rest: null });
  });

  it("handles whitespace-only input as empty", () => {
    expect(truncateDescription("   \n  ")).toEqual({ summary: "", rest: null });
  });

  it("does not split on '.' inside a number when no whitespace follows", () => {
    const r = truncateDescription("Set the timeout to 1.5 seconds. Default is 1.0.");
    expect(r.summary).toBe("Set the timeout to 1.5 seconds.");
    expect(r.rest).toBe("Default is 1.0.");
  });
});
