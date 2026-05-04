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
import { configurationBuilderReducer, INITIAL_STATE } from "./configuration-builder-reducer";
import type { ConfigurationBuilderState } from "@/types/configuration-builder";

describe("configurationBuilderReducer", () => {
  const baseState: ConfigurationBuilderState = {
    ...INITIAL_STATE,
    version: "1.0.0",
  };

  describe("SET_VALUE", () => {
    it("should set a top-level value", () => {
      const result = configurationBuilderReducer(baseState, {
        type: "SET_VALUE",
        path: ["file_format"],
        value: "1.0",
      });
      expect(result.values).toEqual({ file_format: "1.0" });
      expect(result.isDirty).toBe(true);
    });

    it("should set a deeply nested value", () => {
      const state: ConfigurationBuilderState = {
        ...baseState,
        values: {
          tracer_provider: {
            processors: [{ batch: { schedule_delay: 5000 } }],
          },
        },
      };
      const result = configurationBuilderReducer(state, {
        type: "SET_VALUE",
        path: ["tracer_provider", "processors", 0, "batch", "schedule_delay"],
        value: 3000,
      });
      expect((result.values.tracer_provider as Record<string, unknown[]>).processors[0]).toEqual({
        batch: { schedule_delay: 3000 },
      });
      expect(state.values.tracer_provider).toEqual({
        processors: [{ batch: { schedule_delay: 5000 } }],
      });
    });

    it("should clear validation error for the path", () => {
      const state: ConfigurationBuilderState = {
        ...baseState,
        validationErrors: { file_format: "Required" },
      };
      const result = configurationBuilderReducer(state, {
        type: "SET_VALUE",
        path: ["file_format"],
        value: "1.0",
      });
      expect(result.validationErrors).toEqual({});
    });
  });

  describe("SET_ENABLED", () => {
    it("should enable a section with defaults", () => {
      const result = configurationBuilderReducer(baseState, {
        type: "SET_ENABLED",
        section: "tracer_provider",
        enabled: true,
        defaults: { processors: [] },
      });
      expect(result.enabledSections.tracer_provider).toBe(true);
      expect(result.values.tracer_provider).toEqual({ processors: [] });
    });

    it("should disable a section without removing values", () => {
      const state: ConfigurationBuilderState = {
        ...baseState,
        values: { tracer_provider: { processors: [] } },
        enabledSections: { tracer_provider: true },
      };
      const result = configurationBuilderReducer(state, {
        type: "SET_ENABLED",
        section: "tracer_provider",
        enabled: false,
      });
      expect(result.enabledSections.tracer_provider).toBe(false);
      expect(result.values.tracer_provider).toEqual({ processors: [] });
    });

    it("should preserve existing values when re-enabling", () => {
      const state: ConfigurationBuilderState = {
        ...baseState,
        values: { tracer_provider: { processors: [{ batch: {} }] } },
        enabledSections: { tracer_provider: false },
      };
      const result = configurationBuilderReducer(state, {
        type: "SET_ENABLED",
        section: "tracer_provider",
        enabled: true,
        defaults: { processors: [] },
      });
      expect(result.values.tracer_provider).toEqual({
        processors: [{ batch: {} }],
      });
    });
  });

  describe("SELECT_PLUGIN", () => {
    it("should replace subtree with new plugin defaults", () => {
      const state: ConfigurationBuilderState = {
        ...baseState,
        values: { exporter: { otlp_http: { endpoint: "http://localhost" } } },
      };
      const result = configurationBuilderReducer(state, {
        type: "SELECT_PLUGIN",
        path: ["exporter"],
        pluginKey: "otlp_grpc",
        defaults: { otlp_grpc: { endpoint: "" } },
      });
      expect(result.values.exporter).toEqual({ otlp_grpc: { endpoint: "" } });
    });
  });

  describe("ADD_LIST_ITEM / REMOVE_LIST_ITEM", () => {
    it("should append item to list", () => {
      const state: ConfigurationBuilderState = {
        ...baseState,
        values: { items: ["a"] },
      };
      const result = configurationBuilderReducer(state, {
        type: "ADD_LIST_ITEM",
        path: ["items"],
        defaultItem: "b",
      });
      expect(result.values.items).toEqual(["a", "b"]);
    });

    it("should create array if it doesn't exist", () => {
      const result = configurationBuilderReducer(baseState, {
        type: "ADD_LIST_ITEM",
        path: ["items"],
        defaultItem: "a",
      });
      expect(result.values.items).toEqual(["a"]);
    });

    it("should remove item by index", () => {
      const state: ConfigurationBuilderState = {
        ...baseState,
        values: { items: ["a", "b", "c"] },
      };
      const result = configurationBuilderReducer(state, {
        type: "REMOVE_LIST_ITEM",
        path: ["items"],
        index: 1,
      });
      expect(result.values.items).toEqual(["a", "c"]);
    });

    it("appends a stable id on ADD and drops the matching id on REMOVE", () => {
      const afterAdd = configurationBuilderReducer(baseState, {
        type: "ADD_LIST_ITEM",
        path: ["items"],
        defaultItem: "a",
      });
      const addIds = afterAdd.listItemIds!.items;
      expect(addIds).toHaveLength(1);
      const idA = addIds[0];

      const afterTwo = configurationBuilderReducer(afterAdd, {
        type: "ADD_LIST_ITEM",
        path: ["items"],
        defaultItem: "b",
      });
      const twoIds = afterTwo.listItemIds!.items;
      expect(twoIds).toEqual([idA, expect.any(String)]);

      const afterRemove = configurationBuilderReducer(afterTwo, {
        type: "REMOVE_LIST_ITEM",
        path: ["items"],
        index: 0,
      });
      // Removing index 0 should drop idA, not the second id.
      expect(afterRemove.listItemIds!.items).toEqual([twoIds[1]]);
    });
  });

  describe("SET_MAP_ENTRY / REMOVE_MAP_ENTRY", () => {
    it("should set a map entry", () => {
      const result = configurationBuilderReducer(baseState, {
        type: "SET_MAP_ENTRY",
        path: ["distribution"],
        key: "service.name",
        value: "my-service",
      });
      expect(result.values.distribution).toEqual({ "service.name": "my-service" });
    });

    it("should remove a map entry", () => {
      const state: ConfigurationBuilderState = {
        ...baseState,
        values: {
          distribution: { "service.name": "my-service", "service.version": "1.0" },
        },
      };
      const result = configurationBuilderReducer(state, {
        type: "REMOVE_MAP_ENTRY",
        path: ["distribution"],
        key: "service.name",
      });
      expect(result.values.distribution).toEqual({ "service.version": "1.0" });
    });
  });

  describe("LOAD_STATE", () => {
    it("should replace entire state and seed list ids from the loaded values", () => {
      const newState: ConfigurationBuilderState = {
        version: "2.0.0",
        values: { file_format: "2.0", items: ["a", "b"] },
        enabledSections: { tracer_provider: true },
        validationErrors: {},
        isDirty: true,
        listItemIds: {},
      };
      const result = configurationBuilderReducer(baseState, {
        type: "LOAD_STATE",
        state: newState,
      });
      expect(result.values).toEqual(newState.values);
      expect(result.enabledSections).toEqual(newState.enabledSections);
      const ids = result.listItemIds!.items;
      expect(ids).toHaveLength(2);
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe("SET_VALIDATION_ERRORS / SET_FIELD_ERROR", () => {
    it("should set all validation errors", () => {
      const errors = { file_format: "Required", "some.path": "Invalid" };
      const result = configurationBuilderReducer(baseState, {
        type: "SET_VALIDATION_ERRORS",
        errors,
      });
      expect(result.validationErrors).toEqual(errors);
    });

    it("should set a single field error", () => {
      const result = configurationBuilderReducer(baseState, {
        type: "SET_FIELD_ERROR",
        path: "file_format",
        error: "Required",
      });
      expect(result.validationErrors).toEqual({ file_format: "Required" });
    });

    it("should clear a single field error", () => {
      const state: ConfigurationBuilderState = {
        ...baseState,
        validationErrors: { file_format: "Required", other: "Error" },
      };
      const result = configurationBuilderReducer(state, {
        type: "SET_FIELD_ERROR",
        path: "file_format",
        error: null,
      });
      expect(result.validationErrors).toEqual({ other: "Error" });
    });
  });

  describe("SET_ENABLED null-leftover predicate", () => {
    it("populates defaults when the section value is null", () => {
      const initial: ConfigurationBuilderState = {
        version: "1.0.0",
        values: { resource: null },
        enabledSections: {},
        validationErrors: {},
        isDirty: false,
      };
      const next = configurationBuilderReducer(initial, {
        type: "SET_ENABLED",
        section: "resource",
        enabled: true,
        defaults: { attributes: [] },
      });
      expect(next.values.resource).toEqual({ attributes: [] });
      expect(next.enabledSections.resource).toBe(true);
    });
  });

  describe("ENABLE_ALL_SECTIONS", () => {
    it("enables every section and populates defaults for empty ones", () => {
      const initial: ConfigurationBuilderState = {
        version: "1.0.0",
        values: { resource: { attributes: [{ name: "service.name", value: "svc" }] } },
        enabledSections: { resource: true },
        validationErrors: {},
        isDirty: false,
      };
      const next = configurationBuilderReducer(initial, {
        type: "ENABLE_ALL_SECTIONS",
        defaultsBySection: {
          resource: { attributes: [] },
          tracer_provider: { processors: [] },
        },
      });
      expect(next.enabledSections).toEqual({ resource: true, tracer_provider: true });
      expect(next.values.resource).toEqual({
        attributes: [{ name: "service.name", value: "svc" }],
      });
      expect(next.values.tracer_provider).toEqual({ processors: [] });
      expect(next.isDirty).toBe(true);
    });

    it("leaves isDirty false when no section changed", () => {
      const initial: ConfigurationBuilderState = {
        version: "1.0.0",
        values: { resource: {}, tracer_provider: {} },
        enabledSections: { resource: true, tracer_provider: true },
        validationErrors: {},
        isDirty: false,
      };
      const next = configurationBuilderReducer(initial, {
        type: "ENABLE_ALL_SECTIONS",
        defaultsBySection: { resource: {}, tracer_provider: {} },
      });
      expect(next.isDirty).toBe(false);
    });
  });

  describe("SET_OVERRIDE", () => {
    const PATH = ["distribution", "javaagent", "instrumentation"] as const;
    const initial = { ...INITIAL_STATE, version: "1.0.0" };

    function getInst(s: ReturnType<typeof configurationBuilderReducer>) {
      let cur: unknown = s.values;
      for (const seg of PATH) {
        if (!cur || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[seg];
      }
      return cur as { enabled?: string[]; disabled?: string[] } | undefined;
    }

    it("adds a module to disabled[] sorted alphabetically", () => {
      let s = configurationBuilderReducer(initial, {
        type: "SET_OVERRIDE",
        module: "kafka_clients",
        status: "disabled",
      });
      s = configurationBuilderReducer(s, {
        type: "SET_OVERRIDE",
        module: "cassandra",
        status: "disabled",
      });
      expect(getInst(s)?.disabled).toEqual(["cassandra", "kafka_clients"]);
      expect(getInst(s)?.enabled).toBeUndefined();
    });

    it("moves a module between arrays atomically (no duplicates)", () => {
      let s = configurationBuilderReducer(initial, {
        type: "SET_OVERRIDE",
        module: "cassandra",
        status: "disabled",
      });
      s = configurationBuilderReducer(s, {
        type: "SET_OVERRIDE",
        module: "cassandra",
        status: "enabled",
      });
      expect(getInst(s)?.disabled).toBeUndefined();
      expect(getInst(s)?.enabled).toEqual(["cassandra"]);
    });

    it("removes a module from both arrays when status is none", () => {
      let s = configurationBuilderReducer(initial, {
        type: "SET_OVERRIDE",
        module: "cassandra",
        status: "disabled",
      });
      s = configurationBuilderReducer(s, {
        type: "SET_OVERRIDE",
        module: "cassandra",
        status: "none",
      });
      expect(s.values["distribution"]).toBeUndefined();
    });

    it("recovers from corrupt initial state (module in both arrays)", () => {
      const corrupt = {
        ...initial,
        values: {
          distribution: {
            javaagent: {
              instrumentation: { enabled: ["cassandra"], disabled: ["cassandra"] },
            },
          },
        },
      };
      const s = configurationBuilderReducer(corrupt, {
        type: "SET_OVERRIDE",
        module: "cassandra",
        status: "disabled",
      });
      expect(getInst(s)?.enabled).toBeUndefined();
      expect(getInst(s)?.disabled).toEqual(["cassandra"]);
    });

    it("sets isDirty", () => {
      const s = configurationBuilderReducer(initial, {
        type: "SET_OVERRIDE",
        module: "cassandra",
        status: "disabled",
      });
      expect(s.isDirty).toBe(true);
    });
  });
});
