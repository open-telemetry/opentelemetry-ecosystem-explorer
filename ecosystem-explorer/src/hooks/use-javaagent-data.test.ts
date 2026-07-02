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
import { renderHook, waitFor } from "@testing-library/react";
import { useLibraryReadme } from "./use-javaagent-data";

vi.mock("@/lib/api/javaagent-data", () => ({
  loadLibraryReadme: vi.fn(),
}));

import * as javaagentData from "@/lib/api/javaagent-data";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useLibraryReadme", () => {
  it("should start in loading state so callers don't render an empty/error state first", () => {
    (javaagentData.loadLibraryReadme as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    );

    const { result } = renderHook(() => useLibraryReadme("some-library", "abc123"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should load the readme successfully", async () => {
    (javaagentData.loadLibraryReadme as ReturnType<typeof vi.fn>).mockResolvedValue(
      "# Readme content"
    );

    const { result } = renderHook(() => useLibraryReadme("some-library", "abc123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe("# Readme content");
    expect(result.current.error).toBeNull();
  });
});
