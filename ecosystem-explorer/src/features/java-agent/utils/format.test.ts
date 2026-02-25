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
import { getInstrumentationDisplayName } from "./format";
import type { InstrumentationData } from "@/types/javaagent";

describe("getInstrumentationDisplayName", () => {
  it("returns display_name when provided", () => {
    const instrumentation: InstrumentationData = {
      name: "jdbc-2.0.0",
      display_name: "JDBC Database",
      scope: { name: "jdbc" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("JDBC Database");
  });

  it("formats name by stripping version from end", () => {
    const instrumentation: InstrumentationData = {
      name: "spring-web-1.0.0",
      scope: { name: "spring" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Spring Web");
  });

  it("formats name by converting dashes to spaces", () => {
    const instrumentation: InstrumentationData = {
      name: "http-client",
      scope: { name: "http" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Http Client");
  });

  it("formats name by capitalizing first letter", () => {
    const instrumentation: InstrumentationData = {
      name: "kafka",
      scope: { name: "kafka" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Kafka");
  });

  it("handles complex version suffixes", () => {
    const instrumentation: InstrumentationData = {
      name: "redis-client-3.2.1-alpha",
      scope: { name: "redis" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Redis Client");
  });

  it("handles names without versions", () => {
    const instrumentation: InstrumentationData = {
      name: "mongo-db",
      scope: { name: "mongo" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Mongo Db");
  });

  it("handles single word names", () => {
    const instrumentation: InstrumentationData = {
      name: "jdbc",
      scope: { name: "jdbc" },
    };

    expect(getInstrumentationDisplayName(instrumentation)).toBe("Jdbc");
  });
});
