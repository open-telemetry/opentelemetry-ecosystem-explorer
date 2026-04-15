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
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConfigurationBuilderState } from "./use-configuration-builder";
import type { GroupNode, NumberInputNode, TextInputNode } from "@/types/configuration";

const STORAGE_KEY = "otel-config-builder-state-v1";

const mockSchema: GroupNode = {
  controlType: "group",
  key: "root",
  label: "Root",
  path: "",
  children: [
    {
      controlType: "text_input",
      key: "file_format",
      label: "File Format",
      path: "file_format",
      required: true,
    } as TextInputNode,
    {
      controlType: "group",
      key: "attribute_limits",
      label: "Attribute Limits",
      path: "attribute_limits",
      children: [
        {
          controlType: "number_input",
          key: "attribute_count_limit",
          label: "Attribute Count Limit",
          path: "attribute_limits.attribute_count_limit",
          nullable: true,
          constraints: { minimum: 0 },
        } as NumberInputNode,
      ],
    } as GroupNode,
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useConfigurationBuilderState", () => {
  it("should initialize with empty state", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
    expect(result.current.state.values).toEqual({});
    expect(result.current.state.isDirty).toBe(false);
  });

  it("should set a value", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
    act(() => {
      result.current.setValue("file_format", "1.0");
    });
    expect(result.current.state.values.file_format).toBe("1.0");
    expect(result.current.state.isDirty).toBe(true);
  });

  it("should enable a section with defaults", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
    act(() => {
      result.current.setEnabled("attribute_limits", true);
    });
    expect(result.current.state.enabledSections.attribute_limits).toBe(true);
    expect(result.current.state.values.attribute_limits).toBeDefined();
  });

  it("should reset to defaults", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
    act(() => {
      result.current.setValue("file_format", "1.0");
      result.current.resetToDefaults();
    });
    expect(result.current.state.values).toEqual({});
    expect(result.current.state.isDirty).toBe(false);
  });

  it("should validate a field", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
    const error = result.current.validateField("file_format");
    expect(error).toBe("Required");
  });

  it("should validate all fields", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
    const validation = result.current.validateAll();
    expect(validation.valid).toBe(false);
    expect(validation.errors.file_format).toBe("Required");
  });

  it("should auto-clear validation error on setValue", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
    act(() => {
      result.current.validateAll();
    });
    expect(result.current.state.validationErrors.file_format).toBe("Required");
    act(() => {
      result.current.setValue("file_format", "1.0");
    });
    expect(result.current.state.validationErrors.file_format).toBeUndefined();
  });

  it("should clear validation error explicitly", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
    act(() => {
      result.current.validateAll();
    });
    expect(result.current.state.validationErrors.file_format).toBe("Required");
    act(() => {
      result.current.clearValidationError("file_format");
    });
    expect(result.current.state.validationErrors.file_format).toBeUndefined();
  });

  it("should leave other errors untouched when clearing one", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
    act(() => {
      result.current.setEnabled("attribute_limits", true);
    });
    act(() => {
      result.current.setValue("attribute_limits.attribute_count_limit", -1);
    });
    act(() => {
      result.current.validateAll();
    });
    expect(result.current.state.validationErrors["file_format"]).toBe("Required");
    expect(result.current.state.validationErrors["attribute_limits.attribute_count_limit"]).toBe(
      "Must be at least 0"
    );
    act(() => {
      result.current.clearValidationError("attribute_limits.attribute_count_limit");
    });
    expect(result.current.state.validationErrors["file_format"]).toBe("Required");
    expect(
      result.current.state.validationErrors["attribute_limits.attribute_count_limit"]
    ).toBeUndefined();
  });

  it("should reset state when version changes", () => {
    const { result, rerender } = renderHook(
      ({ version }) => useConfigurationBuilderState(mockSchema, version),
      { initialProps: { version: "1.0.0" } }
    );

    act(() => {
      result.current.setValue("file_format", "1.0");
    });
    expect(result.current.state.values.file_format).toBe("1.0");

    rerender({ version: "2.0.0" });

    expect(result.current.state.values).toEqual({});
    expect(result.current.state.version).toBe("2.0.0");
  });

  it("should not persist stale state under new version key after switch", () => {
    const { result, rerender } = renderHook(
      ({ version }) => useConfigurationBuilderState(mockSchema, version),
      { initialProps: { version: "1.0.0" } }
    );

    act(() => {
      result.current.setValue("file_format", "1.0");
    });
    rerender({ version: "2.0.0" });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      expect(saved.state.values).toEqual({});
    }
  });

  describe("loadFromYaml", () => {
    it("should populate state from valid YAML", async () => {
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
      vi.useRealTimers();
      await act(async () => {
        await result.current.loadFromYaml(
          "file_format: '1.0'\nattribute_limits:\n  attribute_count_limit: 256\n"
        );
      });
      expect(result.current.state.values.file_format).toBe("1.0");
      expect(result.current.state.enabledSections.attribute_limits).toBe(true);
    });

    it("should throw a controlled error on invalid YAML", async () => {
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
      vi.useRealTimers();
      await expect(result.current.loadFromYaml("key: value\n  bad indent: x")).rejects.toThrow(
        /Failed to parse YAML/
      );
    });

    it("should ignore non-object YAML", async () => {
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
      vi.useRealTimers();
      await act(async () => {
        await result.current.loadFromYaml("just a string");
      });
      expect(result.current.state.values).toEqual({});
    });
  });

  describe("localStorage persistence", () => {
    it("should save to localStorage after debounce", () => {
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
      act(() => {
        result.current.setValue("file_format", "1.0");
      });
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(saved.state.values.file_format).toBe("1.0");
    });

    it("should restore from localStorage on mount", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schemaVersion: "1.0.0",
          state: {
            version: "1.0.0",
            values: { file_format: "1.0" },
            enabledSections: {},
            validationErrors: {},
            isDirty: true,
          },
        })
      );
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
      expect(result.current.state.values.file_format).toBe("1.0");
    });

    it("should discard localStorage if schema version mismatches", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schemaVersion: "0.9.0",
          state: {
            version: "0.9.0",
            values: { file_format: "0.9" },
            enabledSections: {},
            validationErrors: {},
            isDirty: true,
          },
        })
      );
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0"));
      expect(result.current.state.values).toEqual({});
    });
  });
});
