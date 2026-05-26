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
import type {
  ConfigNode,
  ConfigStarter,
  GroupNode,
  NumberInputNode,
  TextInputNode,
} from "@/types/configuration";

const STORAGE_KEY = "otel-config-builder-state-v3";

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
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
    expect(result.current.state.values).toEqual({});
    expect(result.current.state.isDirty).toBe(false);
  });

  it("should set a value", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
    act(() => {
      result.current.setValue("file_format", "1.0");
    });
    expect(result.current.state.values.file_format).toBe("1.0");
    expect(result.current.state.isDirty).toBe(true);
  });

  it("setValueByPath writes the value at the array-form path", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
    act(() => {
      result.current.setValueByPath(["file_format"], "1.0");
    });
    expect(result.current.state.values.file_format).toBe("1.0");
    expect(result.current.state.isDirty).toBe(true);
  });

  it("setValueByPath preserves dotted segments instead of splitting them", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
    act(() => {
      result.current.setValueByPath(
        ["instrumentation/development", "java", "cassandra-4.4", "enabled"],
        true
      );
    });
    const development = result.current.state.values["instrumentation/development"] as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(development.java["cassandra-4.4"].enabled).toBe(true);
    // Guard against future regressions where someone routes setValueByPath
    // through parsePath: that would split "cassandra-4.4" into "cassandra-4"
    // and "4" as separate segments.
    expect(development.java["cassandra-4"]).toBeUndefined();
  });

  it("setCustomization dispatches SET_CUSTOMIZATION and round-trips through state", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
    act(() => {
      result.current.setCustomization("cassandra", "disabled");
    });
    const distribution = result.current.state.values["distribution"] as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(distribution.javaagent.instrumentation.disabled).toEqual(["cassandra"]);
  });

  it("should enable a section with defaults", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
    act(() => {
      result.current.setEnabled("attribute_limits", true);
    });
    expect(result.current.state.enabledSections.attribute_limits).toBe(true);
    expect(result.current.state.values.attribute_limits).toBeDefined();
  });

  it("should reset to defaults", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
    act(() => {
      result.current.setValue("file_format", "1.0");
      result.current.resetToDefaults();
    });
    expect(result.current.state.values).toEqual({});
    expect(result.current.state.isDirty).toBe(false);
  });

  it("should validate a field", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
    const error = result.current.validateField("file_format");
    expect(error).toBe("Required");
  });

  it("should validate all fields", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
    const validation = result.current.validateAll();
    expect(validation.valid).toBe(false);
    expect(validation.errors.file_format).toBe("Required");
  });

  it("should auto-clear validation error on setValue", () => {
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
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
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
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
    const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
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

  describe("loadFromYaml", () => {
    it("should populate state from valid YAML", async () => {
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
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
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
      vi.useRealTimers();
      await expect(result.current.loadFromYaml("key: value\n  bad indent: x")).rejects.toThrow(
        /Failed to parse YAML/
      );
    });

    it("should ignore non-object YAML", async () => {
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
      vi.useRealTimers();
      await act(async () => {
        await result.current.loadFromYaml("just a string");
      });
      expect(result.current.state.values).toEqual({});
    });
  });

  describe("localStorage persistence", () => {
    it("should save to localStorage after debounce", () => {
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
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
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
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
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
      expect(result.current.state.values).toEqual({});
    });

    it("ignores state stored under the previous v2 storage key", () => {
      localStorage.setItem(
        "otel-config-builder-state-v2",
        JSON.stringify({
          schemaVersion: "1.0.0",
          state: {
            version: "1.0.0",
            values: { file_format: "from-v2-storage" },
            enabledSections: {},
            validationErrors: {},
            isDirty: true,
          },
        })
      );
      const { result } = renderHook(() => useConfigurationBuilderState(mockSchema, "1.0.0", null));
      expect(result.current.state.values).toEqual({});
    });
  });

  it("resetToDefaults with starter hydrates from starter", () => {
    const schema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "group",
          key: "resource",
          label: "Resource",
          path: "resource",
          children: [],
        },
      ],
    };
    const starter: ConfigStarter = {
      enabledSections: { resource: true },
      values: { resource: { attributes: [] } },
    };
    const { result } = renderHook(() => useConfigurationBuilderState(schema, "1.0.0", starter));
    act(() => result.current.setEnabled("resource", false));
    expect(result.current.state.enabledSections.resource).toBe(false);
    act(() => result.current.resetToDefaults());
    expect(result.current.state.enabledSections.resource).toBe(true);
    expect(result.current.state.values.resource).toEqual({ attributes: [] });
  });

  it("enableAllSections enables every top-level group child", () => {
    const schema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "group",
          key: "resource",
          label: "Resource",
          path: "resource",
          children: [],
        },
        {
          controlType: "group",
          key: "tracer_provider",
          label: "TracerProvider",
          path: "tracer_provider",
          children: [],
        },
        {
          controlType: "text_input",
          key: "file_format",
          label: "File Format",
          path: "file_format",
        },
      ],
    };
    const { result } = renderHook(() => useConfigurationBuilderState(schema, "1.0.0", null));
    act(() => result.current.enableAllSections());
    expect(result.current.state.enabledSections.resource).toBe(true);
    expect(result.current.state.enabledSections.tracer_provider).toBe(true);
    expect(result.current.state.enabledSections.file_format).toBeUndefined();
  });

  it("selectPlugin works for a plugin_select inside a list item", () => {
    const schema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "list",
          key: "processors",
          label: "Processors",
          path: "processors",
          itemSchema: {
            controlType: "plugin_select",
            key: "item",
            label: "Item",
            path: "processors.item",
            allowCustom: false,
            options: [
              {
                controlType: "group",
                key: "batch",
                label: "Batch",
                path: "processors.item.batch",
                children: [],
              },
              {
                controlType: "group",
                key: "simple",
                label: "Simple",
                path: "processors.item.simple",
                children: [],
              },
            ],
          },
        },
      ],
    };
    const { result } = renderHook(() => useConfigurationBuilderState(schema, "1.0.0", null));
    act(() => result.current.addListItem("processors"));
    expect(result.current.state.values.processors).toEqual([{ batch: {} }]);
    act(() => result.current.selectPlugin("processors[0]", "simple"));
    expect((result.current.state.values.processors as unknown[])[0]).toEqual({ simple: {} });
  });
});
