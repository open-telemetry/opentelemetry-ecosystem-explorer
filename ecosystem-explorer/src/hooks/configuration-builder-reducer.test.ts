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

  describe("RESET_TO_DEFAULTS", () => {
    it("should reset to initial state", () => {
      const state: ConfigurationBuilderState = {
        ...baseState,
        values: { file_format: "1.0" },
        enabledSections: { tracer_provider: true },
        validationErrors: { file_format: "error" },
        isDirty: true,
      };
      const result = configurationBuilderReducer(state, { type: "RESET_TO_DEFAULTS" });
      expect(result.values).toEqual({});
      expect(result.enabledSections).toEqual({});
      expect(result.validationErrors).toEqual({});
      expect(result.isDirty).toBe(false);
    });
  });

  describe("LOAD_STATE", () => {
    it("should replace entire state", () => {
      const newState: ConfigurationBuilderState = {
        version: "2.0.0",
        values: { file_format: "2.0" },
        enabledSections: { tracer_provider: true },
        validationErrors: {},
        isDirty: true,
      };
      const result = configurationBuilderReducer(baseState, {
        type: "LOAD_STATE",
        state: newState,
      });
      expect(result).toEqual(newState);
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
});
