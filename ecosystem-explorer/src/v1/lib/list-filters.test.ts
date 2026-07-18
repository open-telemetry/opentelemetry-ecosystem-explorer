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
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  filtersToHref,
  parseFilters,
  serializeFilters,
} from "./list-filters";

describe("listFilters", () => {
  it("parseFilters falls back to defaults when given an empty string", () => {
    expect(parseFilters("")).toEqual(DEFAULT_FILTERS);
  });

  it("parseFilters reads CSV-encoded multi-select facets (sorted to round-trip cleanly)", () => {
    const parsed = parseFilters(
      "?type=receiver,processor&signal=traces,metrics&stability=stable,beta&distribution=contrib"
    );
    expect(parsed.types).toEqual(["processor", "receiver"]);
    expect(parsed.signals).toEqual(["metrics", "traces"]);
    expect(parsed.stabilities).toEqual(["beta", "stable"]);
    expect(parsed.distributions).toEqual(["contrib"]);
  });

  it("parseFilters reads repeated params as well as CSV (?type=receiver&type=processor)", () => {
    const parsed = parseFilters("?type=receiver&type=processor&signal=traces&signal=logs");
    expect(parsed.types).toEqual(["processor", "receiver"]);
    expect(parsed.signals).toEqual(["logs", "traces"]);
  });

  it("parseFilters trims whitespace from version", () => {
    expect(parseFilters("?version=%20v0.150.0%20").version).toBe("v0.150.0");
    expect(parseFilters("?version=%20%20").version).toBeNull();
  });

  it("parseFilters drops unknown tokens silently", () => {
    const parsed = parseFilters("?type=receiver,unknown&signal=invalid");
    expect(parsed.types).toEqual(["receiver"]);
    expect(parsed.signals).toEqual([]);
  });

  it("parseFilters handles single-value params and falls back on bad enum values", () => {
    const parsed = parseFilters("?version=v0.150.0&q=kafka&sort=bogus&density=compact&page=3");
    expect(parsed.version).toBe("v0.150.0");
    expect(parsed.q).toBe("kafka");
    expect(parsed.sort).toBe("name"); // fallback
    expect(parsed.density).toBe("compact");
    expect(parsed.page).toBe(3);
  });

  it("parseFilters clamps invalid page numbers to 1", () => {
    expect(parseFilters("?page=0").page).toBe(1);
    expect(parseFilters("?page=-5").page).toBe(1);
    expect(parseFilters("?page=abc").page).toBe(1);
  });

  it("serializeFilters omits default values from the URL", () => {
    const params = serializeFilters({});
    expect(params.toString()).toBe("");
  });

  it("serializeFilters sorts multi-select facets for stable URLs", () => {
    const params = serializeFilters({ types: ["processor", "receiver"] });
    expect(params.get("type")).toBe("processor,receiver");
  });

  it("round-trips a complex filter URL", () => {
    const original = parseFilters(
      "?type=receiver&signal=traces&stability=stable,beta&distribution=contrib&version=v0.150.0&q=kafka&sort=updated&density=table&page=2"
    );
    const params = serializeFilters(original);
    const reparsed = parseFilters(params);
    expect(reparsed).toEqual(original);
  });

  it("filtersToHref returns the basePath alone when there are no filters", () => {
    expect(filtersToHref("/collector/components", {})).toBe("/collector/components");
  });

  it("filtersToHref appends a query string for non-default filters", () => {
    const href = filtersToHref("/collector/components", { types: ["receiver"] });
    expect(href).toBe("/collector/components?type=receiver");
  });

  it("activeFilterCount counts facet selections, search, and version (but not sort/density/page)", () => {
    const filters = parseFilters(
      "?type=receiver,processor&signal=traces&q=kafka&sort=updated&page=3"
    );
    expect(activeFilterCount(filters)).toBe(2 + 1 + 1); // types(2) + signals(1) + q(1)
  });
});
