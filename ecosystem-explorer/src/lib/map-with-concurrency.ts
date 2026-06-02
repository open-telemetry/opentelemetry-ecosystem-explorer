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

/**
 * Maps `items` through `fn` with at most `limit` calls in flight at once.
 *
 * A bounded alternative to `Promise.all(items.map(fn))`: results come back in
 * input order, and the first rejection propagates (matching `Promise.all`
 * semantics — in-flight calls are not cancelled). Reach for this when `fn`
 * fans out network/IO work and an unbounded burst would flood the browser's
 * per-host connection cap or the IndexedDB layer.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  // A pool larger than the work-list just leaves some workers idle; clamp to
  // >= 1 so a non-positive limit degrades to sequential rather than spinning up
  // zero workers (which would never drain the queue).
  const poolSize = Math.max(1, Math.min(limit, items.length));

  // Shared cursor. `cursor++` is read-then-increment in a single synchronous
  // step before any await, so no two workers ever claim the same index despite
  // running concurrently — JS's single-threaded model guarantees it.
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: poolSize }, () => worker()));
  return results;
}
