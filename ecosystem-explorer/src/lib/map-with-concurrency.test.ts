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
import { mapWithConcurrency } from "./map-with-concurrency";

describe("mapWithConcurrency", () => {
  it("returns results in input order", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, 2, async (item) => item * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it("passes the item index to fn", async () => {
    const items = ["a", "b", "c"];
    const results = await mapWithConcurrency(items, 2, async (item, index) => `${index}:${item}`);
    expect(results).toEqual(["0:a", "1:b", "2:c"]);
  });

  it("never exceeds the concurrency limit and saturates it when work allows", async () => {
    const limit = 3;
    const items = Array.from({ length: 10 }, (_, i) => i);
    let active = 0;
    let maxActive = 0;

    const results = await mapWithConcurrency(items, limit, async (item) => {
      active++;
      maxActive = Math.max(maxActive, active);
      // Yield so other workers get a chance to start before this one resolves.
      await Promise.resolve();
      await Promise.resolve();
      active--;
      return item;
    });

    expect(maxActive).toBe(limit);
    expect(results).toEqual(items);
  });

  it("preserves input order even when later items settle first", async () => {
    const items = [0, 1, 2, 3];
    const results = await mapWithConcurrency(items, 4, async (item) => {
      // Earlier items wait more ticks, so they settle last.
      const ticks = items.length - item;
      for (let t = 0; t < ticks; t++) await Promise.resolve();
      return `r${item}`;
    });
    expect(results).toEqual(["r0", "r1", "r2", "r3"]);
  });

  it("returns an empty array without calling fn for empty input", async () => {
    let calls = 0;
    const results = await mapWithConcurrency([], 4, async (item) => {
      calls++;
      return item;
    });
    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });

  it("rejects with the first error fn throws", async () => {
    const items = [1, 2, 3];
    await expect(
      mapWithConcurrency(items, 2, async (item) => {
        if (item === 2) throw new Error("boom");
        return item;
      })
    ).rejects.toThrow("boom");
  });

  it("treats a non-positive limit as sequential rather than stalling", async () => {
    const items = [1, 2, 3];
    let active = 0;
    let maxActive = 0;
    const results = await mapWithConcurrency(items, 0, async (item) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active--;
      return item;
    });
    expect(maxActive).toBe(1);
    expect(results).toEqual([1, 2, 3]);
  });
});
