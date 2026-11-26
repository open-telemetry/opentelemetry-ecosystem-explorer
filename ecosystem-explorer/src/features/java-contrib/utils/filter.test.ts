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
import type { ContribComponent, ContribEntry } from "@/types/java-contrib";
import { EMPTY_FILTERS, filterContribEntries, type ContribFilters } from "./filter";

function entry(id: string, overrides: Partial<ContribComponent>): ContribEntry {
  return {
    id,
    problems: [],
    component: {
      name: id,
      display_name: id,
      description: "",
      source_path: id,
      component_types: ["library"],
      docs_url: "https://example.com",
      usage: "",
      status: { stability: "alpha" },
      min_java_version: 8,
      distributions: [],
      configurations: [],
      ...overrides,
    },
  };
}

const ENTRIES = [
  entry("span-stacktrace", { description: "Captures stack traces" }),
  entry("inferred-spans", {
    component_types: ["library", "agent-extension"],
    status: { stability: "beta" },
    min_java_version: 11,
  }),
  entry("jmx-scraper", { component_types: ["standalone"], status: { stability: "stable" } }),
  entry("aws-xray-propagator", {
    distributions: [
      {
        name: "javaagent",
        repository_url: "https://github.com/open-telemetry/opentelemetry-java-instrumentation",
      },
    ],
  }),
];

const ids = (entries: ContribEntry[]) => entries.map((e) => e.id);
const run = (filters: Partial<ContribFilters>) =>
  ids(filterContribEntries(ENTRIES, { ...EMPTY_FILTERS, ...filters }));

describe("filterContribEntries", () => {
  it("returns everything with no filters", () => {
    expect(run({})).toHaveLength(4);
  });

  it("matches the query against id and description", () => {
    expect(run({ query: "STACK traces" })).toEqual(["span-stacktrace"]);
  });

  it("matches any selected component type", () => {
    expect(run({ types: ["agent-extension", "standalone"] })).toEqual([
      "inferred-spans",
      "jmx-scraper",
    ]);
  });

  it("filters by stability", () => {
    expect(run({ stabilities: ["beta"] })).toEqual(["inferred-spans"]);
  });

  it("keeps components whose minimum Java version fits the selected runtime", () => {
    expect(run({ javaVersion: 8 })).toEqual([
      "span-stacktrace",
      "jmx-scraper",
      "aws-xray-propagator",
    ]);
  });

  it("keeps components bundled in the selected distribution", () => {
    expect(run({ distribution: "javaagent" })).toEqual(["aws-xray-propagator"]);
  });
});
