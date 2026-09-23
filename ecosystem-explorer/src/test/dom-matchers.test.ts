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
import { expect, expectTypeOf, it } from "vitest";

it("preserves DOM matcher return types for sync and async assertions", async () => {
  const element = document.createElement("button");
  element.textContent = "Save changes";

  expectTypeOf(expect(element).toHaveTextContent("Save")).toEqualTypeOf<void>();
  const assertion = expect(Promise.resolve(element)).resolves.toHaveTextContent(/Save/);
  expectTypeOf(assertion).toEqualTypeOf<Promise<void>>();
  await assertion;

  expect(element).not.toHaveTextContent("Cancel");
  expect(element).toEqual(expect.toHaveTextContent("Save"));
});
