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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { VersionsIndex } from "@/types/javaagent";

const useVersionsMock = vi.fn();
vi.mock("@/hooks/use-javaagent-data", () => ({
  useVersions: () => useVersionsMock(),
}));

import { useLatestJavaAgentVersion } from "./use-latest-java-agent-version";

describe("useLatestJavaAgentVersion", () => {
  beforeEach(() => useVersionsMock.mockReset());

  it("returns the version flagged is_latest", () => {
    const data: VersionsIndex = {
      versions: [
        { version: "2.26.1", is_latest: false },
        { version: "2.27.0", is_latest: true },
      ],
    };
    useVersionsMock.mockReturnValue({ data, loading: false, error: null });
    const { result } = renderHook(() => useLatestJavaAgentVersion());
    expect(result.current).toBe("2.27.0");
  });

  it("falls back to the first version when none is flagged is_latest", () => {
    const data: VersionsIndex = {
      versions: [
        { version: "2.26.1", is_latest: false },
        { version: "2.27.0", is_latest: false },
      ],
    };
    useVersionsMock.mockReturnValue({ data, loading: false, error: null });
    const { result } = renderHook(() => useLatestJavaAgentVersion());
    expect(result.current).toBe("2.26.1");
  });

  it("returns undefined while loading", () => {
    useVersionsMock.mockReturnValue({ data: null, loading: true, error: null });
    const { result } = renderHook(() => useLatestJavaAgentVersion());
    expect(result.current).toBeUndefined();
  });

  it("returns undefined when versions is empty", () => {
    useVersionsMock.mockReturnValue({
      data: { versions: [] },
      loading: false,
      error: null,
    });
    const { result } = renderHook(() => useLatestJavaAgentVersion());
    expect(result.current).toBeUndefined();
  });
});
