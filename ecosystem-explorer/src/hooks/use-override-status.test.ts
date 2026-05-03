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
import { useConfigurationBuilder } from "./use-configuration-builder";
import { useOverrideStatus, useOverrideStatusMap } from "./use-override-status";

vi.mock("./use-configuration-builder");

const mocked = vi.mocked(useConfigurationBuilder);

function fakeBuilderState(
  enabled: string[] = [],
  disabled: string[] = []
): ReturnType<typeof useConfigurationBuilder> {
  return {
    state: {
      version: "1.0.0",
      values: {
        distribution: {
          javaagent: {
            instrumentation: {
              ...(enabled.length > 0 ? { enabled } : {}),
              ...(disabled.length > 0 ? { disabled } : {}),
            },
          },
        },
      },
      enabledSections: {},
      validationErrors: {},
      isDirty: false,
      listItemIds: {},
    },
  } as unknown as ReturnType<typeof useConfigurationBuilder>;
}

describe("useOverrideStatusMap", () => {
  beforeEach(() => mocked.mockReset());

  it("returns an empty map when there are no overrides", () => {
    mocked.mockReturnValue(fakeBuilderState());
    const { result } = renderHook(() => useOverrideStatusMap());
    expect(result.current.size).toBe(0);
  });

  it("maps each module name to its status", () => {
    mocked.mockReturnValue(fakeBuilderState(["jmx_metrics"], ["cassandra", "kafka_clients"]));
    const { result } = renderHook(() => useOverrideStatusMap());
    expect(result.current.get("cassandra")).toBe("disabled");
    expect(result.current.get("jmx_metrics")).toBe("enabled");
    expect(result.current.get("kafka_clients")).toBe("disabled");
    expect(result.current.size).toBe(3);
  });
});

describe("useOverrideStatus", () => {
  beforeEach(() => mocked.mockReset());

  it("returns 'none' for an unknown module", () => {
    mocked.mockReturnValue(fakeBuilderState());
    const { result } = renderHook(() => useOverrideStatus("cassandra"));
    expect(result.current).toBe("none");
  });

  it("returns 'enabled' / 'disabled' as appropriate", () => {
    mocked.mockReturnValue(fakeBuilderState(["jmx_metrics"], ["cassandra"]));
    expect(renderHook(() => useOverrideStatus("cassandra")).result.current).toBe("disabled");
    expect(renderHook(() => useOverrideStatus("jmx_metrics")).result.current).toBe("enabled");
    expect(renderHook(() => useOverrideStatus("foo")).result.current).toBe("none");
  });
});

describe("useOverrideStatusMap memoization", () => {
  beforeEach(() => mocked.mockReset());

  it("returns the same Map reference across re-renders when state.values is unchanged", () => {
    mocked.mockReturnValue(fakeBuilderState(["jmx_metrics"], ["cassandra"]));
    const { result, rerender } = renderHook(() => useOverrideStatusMap());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
