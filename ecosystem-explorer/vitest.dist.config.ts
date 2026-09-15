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
import { defineConfig } from "vitest/config";

// Tests that exercise build output in `dist/` rather than source. They run after
// `bun run build` (see the "Run edge tests" step in .github/workflows/build-and-test.yml)
// and are excluded from the default unit run, where dist/ does not exist yet.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.dist.test.ts"],
    exclude: ["**/node_modules/**"],
  },
});
