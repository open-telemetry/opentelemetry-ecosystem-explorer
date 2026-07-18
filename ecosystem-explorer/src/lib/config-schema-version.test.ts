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
import { filterSupportedConfigVersions } from "./config-schema-version";

describe("filterSupportedConfigVersions", () => {
  it("drops versions above the pinned ceiling and re-marks the survivor as latest", () => {
    const result = filterSupportedConfigVersions([
      { version: "1.1.0", is_latest: true },
      { version: "1.0.0", is_latest: false },
    ]);
    expect(result).toEqual([{ version: "1.0.0", is_latest: true }]);
  });

  it("marks the highest supported version as latest when several qualify", () => {
    const result = filterSupportedConfigVersions([
      { version: "0.9.0", is_latest: false },
      { version: "1.0.0", is_latest: false },
    ]);
    expect(result.find((v) => v.is_latest)?.version).toBe("1.0.0");
  });

  it("returns an empty list when no version is supported", () => {
    expect(filterSupportedConfigVersions([{ version: "2.0.0", is_latest: true }])).toEqual([]);
  });
});
