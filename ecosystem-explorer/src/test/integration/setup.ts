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

// Must be imported before any module that calls isIDBAvailable(), since
// javaagent-data.ts evaluates `const idbEnabled = isIDBAvailable()` at
// module load time.
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { beforeEach } from "vitest";
import { clearAllCached, closeDB } from "@/lib/api/idb-cache";

// JSDOM does not implement Element.scrollIntoView; provide a stub so that
// click handlers wired to scrollToSection don't throw during tests.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

beforeEach(async () => {
  // Clear stored entries so each test starts with a cold cache.
  await clearAllCached();
  // Reset the IDB singleton (dbInstance, dbInitPromise, dbInitFailed) so
  // the next initDB() call opens a fresh connection.
  closeDB();
});
