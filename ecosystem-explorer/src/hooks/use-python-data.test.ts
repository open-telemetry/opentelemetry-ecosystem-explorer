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
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { usePythonIndex, usePythonPackage } from "./use-python-data";
import type { PythonIndex, PythonPackage } from "@/types/python";

vi.mock("@/lib/api/python-data", () => ({
  loadIndex: vi.fn(),
  loadPackage: vi.fn(),
}));

import * as pythonData from "@/lib/api/python-data";

const loadIndex = pythonData.loadIndex as ReturnType<typeof vi.fn>;
const loadPackage = pythonData.loadPackage as ReturnType<typeof vi.fn>;

const index: PythonIndex = { ecosystem: "python", packages: [] };
const flask: PythonPackage = { name: "opentelemetry-instrumentation-flask" };
const click: PythonPackage = { name: "opentelemetry-instrumentation-click" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("usePythonIndex", () => {
  it("starts loading, then returns the index", async () => {
    loadIndex.mockResolvedValue(index);

    const { result } = renderHook(() => usePythonIndex());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(index);
    expect(result.current.error).toBeNull();
  });

  it("reports a load failure as an error", async () => {
    loadIndex.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => usePythonIndex());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toBe("network down");
  });

  it("wraps a non-Error rejection", async () => {
    loadIndex.mockRejectedValue("boom");

    const { result } = renderHook(() => usePythonIndex());

    await waitFor(() => expect(result.current.error?.message).toBe("boom"));
  });
});

describe("usePythonPackage", () => {
  it("starts loading so callers don't render an empty state first", () => {
    loadPackage.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePythonPackage("opentelemetry-instrumentation-flask"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("loads the requested release", async () => {
    loadPackage.mockResolvedValue(flask);

    const { result } = renderHook(() =>
      usePythonPackage("opentelemetry-instrumentation-flask", "0.66b1")
    );

    await waitFor(() => expect(result.current.data).toEqual(flask));
    expect(loadPackage).toHaveBeenCalledWith("opentelemetry-instrumentation-flask", "0.66b1");
  });

  it("does nothing and reports no error for an empty name", async () => {
    const { result } = renderHook(() => usePythonPackage(""));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(loadPackage).not.toHaveBeenCalled();
  });

  it("reports a load failure as an error", async () => {
    loadPackage.mockRejectedValue(new Error("not found"));

    const { result } = renderHook(() => usePythonPackage("opentelemetry-instrumentation-flask"));

    await waitFor(() => expect(result.current.error?.message).toBe("not found"));
    expect(result.current.data).toBeNull();
  });

  it("never returns the previous package for a new name", async () => {
    loadPackage.mockImplementation(async (name: string) =>
      name.endsWith("flask") ? flask : click
    );

    const { result, rerender } = renderHook(({ name }) => usePythonPackage(name), {
      initialProps: { name: "opentelemetry-instrumentation-flask" },
    });
    await waitFor(() => expect(result.current.data).toEqual(flask));

    rerender({ name: "opentelemetry-instrumentation-click" });
    // The first render after the change must be a loading state, not the stale flask data.
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.data).toEqual(click));
  });

  it("ignores a response that arrives after the component unmounted", async () => {
    let resolve!: (value: PythonPackage) => void;
    loadPackage.mockReturnValue(new Promise<PythonPackage>((r) => (resolve = r)));

    const { result, unmount } = renderHook(() =>
      usePythonPackage("opentelemetry-instrumentation-flask")
    );
    unmount();
    await act(async () => resolve(flask));

    expect(result.current.data).toBeNull();
  });
});
