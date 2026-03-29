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
import { useConfigVersions, useConfigSchema } from "./use-configuration-data";
import type { ConfigVersionsIndex, GroupNode } from "@/types/configuration";

vi.mock("@/lib/api/configuration-data", () => ({
  loadConfigVersions: vi.fn(),
  loadConfigSchema: vi.fn(),
}));

import * as configData from "@/lib/api/configuration-data";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useConfigVersions", () => {
  const mockVersions: ConfigVersionsIndex = {
    versions: [{ version: "1.0.0", is_latest: true }],
  };

  it("should start in loading state", () => {
    (configData.loadConfigVersions as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    );

    const { result } = renderHook(() => useConfigVersions());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should load versions successfully", async () => {
    (configData.loadConfigVersions as ReturnType<typeof vi.fn>).mockResolvedValue(mockVersions);

    const { result } = renderHook(() => useConfigVersions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockVersions);
    expect(result.current.error).toBeNull();
  });

  it("should handle errors", async () => {
    (configData.loadConfigVersions as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );

    const { result } = renderHook(() => useConfigVersions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(new Error("Network error"));
  });

  it("should not update state after unmount", async () => {
    let resolve: (value: ConfigVersionsIndex) => void;
    (configData.loadConfigVersions as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const { result, unmount } = renderHook(() => useConfigVersions());

    expect(result.current.loading).toBe(true);
    unmount();

    resolve!({ versions: [{ version: "1.0.0", is_latest: true }] });

    // State should remain loading since the component unmounted
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });
});

describe("useConfigSchema", () => {
  const mockSchema: GroupNode = {
    controlType: "group",
    key: "root",
    label: "Root",
    path: "",
    children: [],
  };

  it("should start in loading state", () => {
    (configData.loadConfigSchema as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    );

    const { result } = renderHook(() => useConfigSchema("1.0.0"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("should load schema for given version", async () => {
    (configData.loadConfigSchema as ReturnType<typeof vi.fn>).mockResolvedValue(mockSchema);

    const { result } = renderHook(() => useConfigSchema("1.0.0"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockSchema);
    expect(configData.loadConfigSchema).toHaveBeenCalledWith("1.0.0");
  });

  it("should skip loading when version is empty", async () => {
    const { result } = renderHook(() => useConfigSchema(""));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(configData.loadConfigSchema).not.toHaveBeenCalled();
  });

  it("should reload when version changes", async () => {
    const schema1: GroupNode = { ...mockSchema, key: "root1" };
    const schema2: GroupNode = { ...mockSchema, key: "root2" };

    (configData.loadConfigSchema as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(schema1)
      .mockResolvedValueOnce(schema2);

    const { result, rerender } = renderHook(({ version }) => useConfigSchema(version), {
      initialProps: { version: "1.0.0" },
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(schema1);
    });

    rerender({ version: "2.0.0" });

    await waitFor(() => {
      expect(result.current.data).toEqual(schema2);
    });

    expect(configData.loadConfigSchema).toHaveBeenCalledWith("1.0.0");
    expect(configData.loadConfigSchema).toHaveBeenCalledWith("2.0.0");
  });

  it("should handle errors", async () => {
    (configData.loadConfigSchema as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Schema not found")
    );

    const { result } = renderHook(() => useConfigSchema("1.0.0"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(new Error("Schema not found"));
  });
});
