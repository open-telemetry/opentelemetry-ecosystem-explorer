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
import { diffSchemas, type SchemaKey } from "./schema-diff";

const KEEP: SchemaKey = { key: "endpoint", type: "string", description: "Where to listen." };
const REMOVED: SchemaKey = { key: "old_key", type: "int", description: "Legacy timeout." };
const TYPE_CHANGED_FROM: SchemaKey = { key: "timeout", type: "int", description: "ms" };
const TYPE_CHANGED_TO: SchemaKey = { key: "timeout", type: "duration", description: "ms" };
const ADDED: SchemaKey = { key: "tls.enabled", type: "bool", description: "Enable TLS." };
const RENAMED_FROM: SchemaKey = {
  key: "max_concurrency",
  type: "int",
  description: "Max workers.",
};
const RENAMED_TO: SchemaKey = { key: "concurrency", type: "int", description: "Max workers." };

describe("schemaDiff", () => {
  it("buckets an unchanged key into `unchanged`", () => {
    const diff = diffSchemas([KEEP], [KEEP]);
    expect(diff.unchanged).toEqual([KEEP]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("detects a pure addition", () => {
    const diff = diffSchemas([], [ADDED]);
    expect(diff.added).toEqual([ADDED]);
  });

  it("detects a pure removal", () => {
    const diff = diffSchemas([REMOVED], []);
    expect(diff.removed).toEqual([REMOVED]);
  });

  it("detects a type change", () => {
    const diff = diffSchemas([TYPE_CHANGED_FROM], [TYPE_CHANGED_TO]);
    expect(diff.typeChanged).toEqual([{ key: "timeout", fromType: "int", toType: "duration" }]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("detects a rename via matching description + type", () => {
    const diff = diffSchemas([RENAMED_FROM], [RENAMED_TO]);
    expect(diff.renamed).toEqual([{ from: RENAMED_FROM, to: RENAMED_TO }]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("does not over-pair renames when descriptions differ", () => {
    const diff = diffSchemas(
      [{ key: "a", type: "int", description: "one" }],
      [{ key: "b", type: "int", description: "two" }]
    );
    expect(diff.renamed).toEqual([]);
    expect(diff.added.map((k) => k.key)).toEqual(["b"]);
    expect(diff.removed.map((k) => k.key)).toEqual(["a"]);
  });

  it("handles a mixed diff with added / removed / renamed / type-changed / unchanged", () => {
    const from = [KEEP, REMOVED, TYPE_CHANGED_FROM, RENAMED_FROM];
    const to = [KEEP, TYPE_CHANGED_TO, RENAMED_TO, ADDED];
    const diff = diffSchemas(from, to);
    expect(diff.added.map((k) => k.key)).toEqual(["tls.enabled"]);
    expect(diff.removed.map((k) => k.key)).toEqual(["old_key"]);
    expect(diff.renamed.map((r) => `${r.from.key}->${r.to.key}`)).toEqual([
      "max_concurrency->concurrency",
    ]);
    expect(diff.typeChanged.map((t) => t.key)).toEqual(["timeout"]);
    expect(diff.unchanged.map((k) => k.key)).toEqual(["endpoint"]);
  });
});
