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

/*
 * schemaDiff — pure function that compares two version's config schemas
 * and produces a structured diff (added / removed / renamed / type-changed
 * keys). Lives in `lib/` so it's testable in isolation.
 *
 * Inputs are arrays of `SchemaKey` (key + type + optional default +
 * description). Renames are detected via a simple pairing: a key removed
 * from `from` whose `description` matches a key added in `to` and whose
 * `type` is the same is treated as a rename rather than two independent
 * add/remove.
 *
 * This is intentionally simple — the real registry may eventually emit
 * explicit rename hints; until then this heuristic is good enough for v1
 * diff display.
 */

export interface SchemaKey {
  key: string;
  type?: string;
  defaultValue?: string;
  description?: string;
}

export interface SchemaDiff {
  added: SchemaKey[];
  removed: SchemaKey[];
  renamed: Array<{ from: SchemaKey; to: SchemaKey }>;
  typeChanged: Array<{ key: string; fromType: string; toType: string }>;
  unchanged: SchemaKey[];
}

export function diffSchemas(from: SchemaKey[], to: SchemaKey[]): SchemaDiff {
  const fromMap = new Map(from.map((k) => [k.key, k]));
  const toMap = new Map(to.map((k) => [k.key, k]));

  const added: SchemaKey[] = [];
  const removed: SchemaKey[] = [];
  const renamed: Array<{ from: SchemaKey; to: SchemaKey }> = [];
  const typeChanged: Array<{ key: string; fromType: string; toType: string }> = [];
  const unchanged: SchemaKey[] = [];

  // First pass: bucket by simple key membership
  for (const [key, k] of toMap.entries()) {
    if (!fromMap.has(key)) {
      added.push(k);
    } else {
      const prev = fromMap.get(key)!;
      const t1 = prev.type ?? "";
      const t2 = k.type ?? "";
      if (t1 && t2 && t1 !== t2) {
        typeChanged.push({ key, fromType: t1, toType: t2 });
      } else {
        unchanged.push(k);
      }
    }
  }
  for (const [key, k] of fromMap.entries()) {
    if (!toMap.has(key)) removed.push(k);
  }

  // Rename heuristic: pair a removed and an added with the same description
  // and the same type. Mutates `added` / `removed` in place.
  for (const rem of removed.slice()) {
    if (!rem.description) continue;
    const match = added.find(
      (a) => a.description === rem.description && (a.type ?? "") === (rem.type ?? "")
    );
    if (match) {
      renamed.push({ from: rem, to: match });
      added.splice(added.indexOf(match), 1);
      removed.splice(removed.indexOf(rem), 1);
    }
  }

  // Sort each bucket for stable rendering
  added.sort((a, b) => a.key.localeCompare(b.key));
  removed.sort((a, b) => a.key.localeCompare(b.key));
  renamed.sort((a, b) => a.from.key.localeCompare(b.from.key));
  typeChanged.sort((a, b) => a.key.localeCompare(b.key));
  unchanged.sort((a, b) => a.key.localeCompare(b.key));

  return { added, removed, renamed, typeChanged, unchanged };
}
