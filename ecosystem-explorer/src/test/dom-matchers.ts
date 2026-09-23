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
import * as matchers from "@testing-library/jest-dom/matchers";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

// jest-dom 7.0.1 still augments the pre-Vitest-5 Assertion<T> interface.
// Register its matchers directly and preserve Vitest's sync/async return type.
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Module augmentation adds the DOM matchers.
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
  > extends TestingLibraryMatchers<never, R> {}
}

expect.extend(matchers);
