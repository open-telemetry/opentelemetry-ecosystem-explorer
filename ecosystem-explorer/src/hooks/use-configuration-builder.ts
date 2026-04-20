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
import { useReducer, useEffect, useCallback, useRef, createContext, useContext } from "react";
import type { ConfigNode, ListNode, PluginSelectNode } from "@/types/configuration";
import type {
  ConfigValue,
  ConfigValues,
  ConfigurationBuilderState,
  ValidationResult,
} from "@/types/configuration-builder";
import { configurationBuilderReducer, INITIAL_STATE } from "./configuration-builder-reducer";
import { parsePath, serializePath, getByPath } from "@/lib/config-path";
import {
  buildDefaults,
  buildListItemDefaults,
  buildPluginDefaults,
  findNodeByPath,
} from "@/lib/schema-defaults";
import {
  validateField as validateFieldNode,
  validateAll as validateAllNodes,
} from "@/lib/config-validation";

const STORAGE_KEY = "otel-config-builder-state-v1";

export interface ConfigurationBuilderStateContextValue {
  state: ConfigurationBuilderState;
}

export interface ConfigurationBuilderActionsContextValue {
  setValue: (path: string, value: ConfigValue) => void;
  setEnabled: (section: string, enabled: boolean) => void;
  selectPlugin: (path: string, pluginKey: string) => void;
  addListItem: (path: string) => void;
  removeListItem: (path: string, index: number) => void;
  setMapEntry: (path: string, key: string, value: string) => void;
  removeMapEntry: (path: string, key: string) => void;
  resetToDefaults: () => void;
  loadFromYaml: (yaml: string) => Promise<void>;
  validateField: (path: string) => string | null;
  validateAll: () => ValidationResult;
  clearValidationError: (path: string) => void;
}

export const ConfigStateContext = createContext<ConfigurationBuilderStateContextValue | null>(null);
export const ConfigDispatchContext = createContext<ConfigurationBuilderActionsContextValue | null>(
  null
);

function loadFromStorage(version: string): ConfigurationBuilderState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== version) {
      console.warn(
        `Discarding saved config builder state: saved for schema ${parsed.schemaVersion}, current is ${version}`
      );
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.state;
  } catch {
    return null;
  }
}

function saveToStorage(version: string, state: ConfigurationBuilderState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: version, state }));
  } catch {
    // QuotaExceededError -- silently ignore
  }
}

export function useConfigurationBuilderState(schema: ConfigNode, version: string) {
  const [state, dispatch] = useReducer(
    configurationBuilderReducer,
    version,
    (v) => loadFromStorage(v) ?? { ...INITIAL_STATE, version: v }
  );
  const stateRef = useRef(state);
  const schemaRef = useRef(schema);
  const versionRef = useRef(version);
  const loadedVersionRef = useRef(version);

  // Keep refs in sync so callbacks always have access to the latest values
  useEffect(() => {
    stateRef.current = state;
    schemaRef.current = schema;
    versionRef.current = version;
  });

  // Reload state when version changes
  useEffect(() => {
    if (loadedVersionRef.current === version) return;
    loadedVersionRef.current = version;
    const saved = loadFromStorage(version);
    dispatch({
      type: "LOAD_STATE",
      state: saved ?? { ...INITIAL_STATE, version },
    });
  }, [version]);

  // Debounced localStorage save
  useEffect(() => {
    if (!state.isDirty) return;
    if (state.version !== version) return;
    const timer = setTimeout(() => {
      saveToStorage(version, state);
    }, 500);
    return () => clearTimeout(timer);
  }, [state, version]);

  // Flush on beforeunload
  useEffect(() => {
    function handleBeforeUnload() {
      saveToStorage(version, stateRef.current);
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [version]);

  const setValue = useCallback((path: string, value: ConfigValue) => {
    dispatch({ type: "SET_VALUE", path: parsePath(path), value });
  }, []);

  const setEnabled = useCallback((section: string, enabled: boolean) => {
    let defaults: ConfigValues | undefined;
    if (enabled) {
      const sectionNode = findNodeByPath(schemaRef.current, [section]);
      if (sectionNode && sectionNode.controlType === "group") {
        const built = buildDefaults(sectionNode);
        if (typeof built === "object" && built !== null && !Array.isArray(built)) {
          defaults = built as ConfigValues;
        }
      }
    }
    dispatch({ type: "SET_ENABLED", section, enabled, defaults });
  }, []);

  const selectPlugin = useCallback((path: string, pluginKey: string) => {
    const segments = parsePath(path);
    const node = findNodeByPath(
      schemaRef.current,
      segments.filter((s) => typeof s === "string")
    );
    if (node && node.controlType === "plugin_select") {
      const defaults = buildPluginDefaults(node as PluginSelectNode, pluginKey);
      dispatch({ type: "SELECT_PLUGIN", path: segments, pluginKey, defaults });
    }
  }, []);

  const addListItem = useCallback((path: string) => {
    const segments = parsePath(path);
    const node = findNodeByPath(
      schemaRef.current,
      segments.filter((s) => typeof s === "string")
    );
    if (
      node &&
      (node.controlType === "list" ||
        node.controlType === "string_list" ||
        node.controlType === "number_list")
    ) {
      const defaultItem = buildListItemDefaults(node as ListNode);
      dispatch({ type: "ADD_LIST_ITEM", path: segments, defaultItem });
    }
  }, []);

  const removeListItem = useCallback((path: string, index: number) => {
    dispatch({ type: "REMOVE_LIST_ITEM", path: parsePath(path), index });
  }, []);

  const setMapEntry = useCallback((path: string, key: string, value: string) => {
    dispatch({ type: "SET_MAP_ENTRY", path: parsePath(path), key, value });
  }, []);

  const removeMapEntry = useCallback((path: string, key: string) => {
    dispatch({ type: "REMOVE_MAP_ENTRY", path: parsePath(path), key });
  }, []);

  const resetToDefaults = useCallback(() => {
    dispatch({ type: "RESET_TO_DEFAULTS" });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadFromYaml = useCallback(async (yaml: string) => {
    let parsed: unknown;
    try {
      const jsYaml = await import("js-yaml");
      parsed = jsYaml.load(yaml);
    } catch (error) {
      throw new Error("Failed to parse YAML configuration", { cause: error });
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;

    const values = parsed as ConfigValues;
    const enabledSections: Record<string, boolean> = {};
    for (const key of Object.keys(values)) {
      if (typeof values[key] === "object" && values[key] !== null) {
        enabledSections[key] = true;
      }
    }

    dispatch({
      type: "LOAD_STATE",
      state: {
        version: versionRef.current,
        values,
        enabledSections,
        validationErrors: {},
        isDirty: true,
      },
    });
  }, []);

  const validateFieldAction = useCallback((path: string): string | null => {
    const segments = parsePath(path);
    const node = findNodeByPath(
      schemaRef.current,
      segments.filter((s) => typeof s === "string")
    );
    if (!node) return null;
    const value = getByPath(stateRef.current.values, segments);
    const error = validateFieldNode(node, value);
    const pathKey = serializePath(segments);
    dispatch({ type: "SET_FIELD_ERROR", path: pathKey, error });
    return error;
  }, []);

  const validateAllAction = useCallback((): ValidationResult => {
    const result = validateAllNodes(
      schemaRef.current,
      stateRef.current.values,
      stateRef.current.enabledSections
    );
    dispatch({ type: "SET_VALIDATION_ERRORS", errors: result.errors });
    return result;
  }, []);

  const clearValidationError = useCallback((path: string) => {
    const pathKey = serializePath(parsePath(path));
    dispatch({ type: "SET_FIELD_ERROR", path: pathKey, error: null });
  }, []);

  return {
    state,
    setValue,
    setEnabled,
    selectPlugin,
    addListItem,
    removeListItem,
    setMapEntry,
    removeMapEntry,
    resetToDefaults,
    loadFromYaml,
    validateField: validateFieldAction,
    validateAll: validateAllAction,
    clearValidationError,
  };
}

export function useConfigurationBuilder() {
  const stateValue = useContext(ConfigStateContext);
  const actionsValue = useContext(ConfigDispatchContext);
  if (!stateValue || !actionsValue) {
    throw new Error("useConfigurationBuilder must be used within ConfigurationBuilderProvider");
  }
  return { ...stateValue, ...actionsValue };
}

export function useConfigurationBuilderActions() {
  const actionsValue = useContext(ConfigDispatchContext);
  if (!actionsValue) {
    throw new Error(
      "useConfigurationBuilderActions must be used within ConfigurationBuilderProvider"
    );
  }
  return actionsValue;
}

export function useConfigurationBuilderStateOnly() {
  const stateValue = useContext(ConfigStateContext);
  if (!stateValue) {
    throw new Error(
      "useConfigurationBuilderStateOnly must be used within ConfigurationBuilderProvider"
    );
  }
  return stateValue;
}
