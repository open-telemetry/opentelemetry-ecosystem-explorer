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
import { parsePath, serializePath, getByPath, setByPath } from "./config-path";

describe("parsePath", () => {
  it("should parse simple dotted path", () => {
    expect(parsePath("attribute_limits.attribute_count_limit")).toEqual([
      "attribute_limits",
      "attribute_count_limit",
    ]);
  });

  it("should parse path with array index", () => {
    expect(parsePath("tracer_provider.processors[0].batch")).toEqual([
      "tracer_provider",
      "processors",
      0,
      "batch",
    ]);
  });

  it("should parse path with multiple array indices", () => {
    expect(parsePath("a[0].b[1].c")).toEqual(["a", 0, "b", 1, "c"]);
  });

  it("should parse single segment", () => {
    expect(parsePath("file_format")).toEqual(["file_format"]);
  });
});

describe("serializePath", () => {
  it("should serialize simple path", () => {
    expect(serializePath(["attribute_limits", "attribute_count_limit"])).toBe(
      "attribute_limits.attribute_count_limit"
    );
  });

  it("should serialize path with array index", () => {
    expect(serializePath(["tracer_provider", "processors", 0, "batch"])).toBe(
      "tracer_provider.processors[0].batch"
    );
  });

  it("should round-trip with parsePath", () => {
    const original = "tracer_provider.processors[0].batch.exporter";
    expect(serializePath(parsePath(original))).toBe(original);
  });
});

describe("getByPath", () => {
  const obj = {
    tracer_provider: {
      processors: [{ batch: { schedule_delay: 5000 } }],
    },
  };

  it("should get nested value", () => {
    expect(getByPath(obj, ["tracer_provider", "processors", 0, "batch", "schedule_delay"])).toBe(
      5000
    );
  });

  it("should return undefined for missing path", () => {
    expect(getByPath(obj, ["tracer_provider", "nonexistent"])).toBeUndefined();
  });

  it("should return undefined for null intermediate", () => {
    expect(getByPath({ a: null }, ["a", "b"])).toBeUndefined();
  });
});

describe("setByPath", () => {
  it("should set nested value immutably", () => {
    const obj = { a: { b: { c: 1 } } };
    const result = setByPath(obj, ["a", "b", "c"], 2);
    expect(result).toEqual({ a: { b: { c: 2 } } });
    expect(obj.a.b.c).toBe(1);
  });

  it("should set value in array", () => {
    const obj = { items: [{ name: "a" }, { name: "b" }] };
    const result = setByPath(obj, ["items", 1, "name"], "c");
    expect(result).toEqual({ items: [{ name: "a" }, { name: "c" }] });
    expect(obj.items[1].name).toBe("b");
  });

  it("should create intermediate objects", () => {
    const obj = {};
    const result = setByPath(obj, ["a", "b"], "value");
    expect(result).toEqual({ a: { b: "value" } });
  });
});
