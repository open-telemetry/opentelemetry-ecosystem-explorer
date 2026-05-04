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
import {
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
} from "react";
import type {
  ConfigNode,
  ConfigStarter,
  GroupNode,
  ListNode,
  PluginSelectNode,
} from "@/types/configuration";
import type {
  ConfigValue,
  ConfigValues,
  ConfigurationBuilderState,
  Path,
  ValidationResult,
} from "@/types/configuration-builder";
import { configurationBuilderReducer } from "./configuration-builder-reducer";
import { parsePath, serializePath, getByPath } from "@/lib/config-path";
import {
  buildDefaults,
  buildListItemDefaults,
  buildPluginDefaults,
  findNodeByPath,
} from "@/lib/schema-defaults";
import { hydrateStarterState } from "@/lib/state-hydrate";
import { buildListItemIds } from "@/lib/build-list-item-ids";
import { load as loadYaml } from "js-yaml";
import { isPlainObject } from "@/lib/value-guards";
import {
  validateField as validateFieldNode,
  validateAll as validateAllNodes,
} from "@/lib/config-validation";

const STORAGE_KEY = "otel-config-builder-state-v2";

export interface ConfigurationBuilderStateContextValue {
  state: ConfigurationBuilderState;
}

export interface ConfigurationBuilderActionsContextValue {
  setValue: (path: string, value: ConfigValue) => void;
  setValueByPath: (path: Path, value: ConfigValue) => void;
  setOverride: (module: string, status: "enabled" | "disabled" | "none") => void;
  setEnabled: (section: string, enabled: boolean) => void;
  selectPlugin: (path: string, pluginKey: string) => void;
  addListItem: (path: string) => void;
  removeListItem: (path: string, index: number) => void;
  setMapEntry: (path: string, key: string, value: string) => void;
  removeMapEntry: (path: string, key: string) => void;
  resetToDefaults: () => void;
  enableAllSections: () => void;
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
    const restored = parsed.state as ConfigurationBuilderState;
    // Forward-compat: older saved states predate listItemIds; rebuild on load.
    if (!restored.listItemIds) {
      restored.listItemIds = buildListItemIds(restored.values);
    }
    return restored;
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

export function useConfigurationBuilderState(
  schema: ConfigNode,
  version: string,
  starter: ConfigStarter | null
) {
  const [state, dispatch] = useReducer(
    configurationBuilderReducer,
    version,
    (v) => loadFromStorage(v) ?? hydrateStarterState(v, starter)
  );
  const stateRef = useRef(state);
  const schemaRef = useRef(schema);
  const versionRef = useRef(version);
  const starterRef = useRef(starter);

  // Keep refs in sync so callbacks always have access to the latest values
  useEffect(() => {
    stateRef.current = state;
    schemaRef.current = schema;
    versionRef.current = version;
    starterRef.current = starter;
  }, [state, schema, version, starter]);

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

  // Array-form sibling of setValue, for paths whose segments may contain dots.
  const setValueByPath = useCallback((path: Path, value: ConfigValue) => {
    dispatch({ type: "SET_VALUE", path, value });
  }, []);

  const setOverride = useCallback((module: string, status: "enabled" | "disabled" | "none") => {
    dispatch({ type: "SET_OVERRIDE", module, status });
  }, []);

  const setEnabled = useCallback((section: string, enabled: boolean) => {
    let defaults: ConfigValues | undefined;
    if (enabled) {
      const sectionNode = findNodeByPath(schemaRef.current, [section]);
      if (sectionNode && sectionNode.controlType === "group") {
        const built = buildDefaults(sectionNode);
        if (isPlainObject(built)) defaults = built;
      }
    }
    dispatch({ type: "SET_ENABLED", section, enabled, defaults });
  }, []);

  const selectPlugin = useCallback((path: string, pluginKey: string) => {
    const segments = parsePath(path);
    const node = findNodeByPath(schemaRef.current, segments);
    if (node && node.controlType === "plugin_select") {
      const defaults = buildPluginDefaults(node as PluginSelectNode, pluginKey);
      dispatch({ type: "SELECT_PLUGIN", path: segments, pluginKey, defaults });
    }
  }, []);

  const addListItem = useCallback((path: string) => {
    const segments = parsePath(path);
    const node = findNodeByPath(schemaRef.current, segments);
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
    dispatch({
      type: "LOAD_STATE",
      state: hydrateStarterState(versionRef.current, starterRef.current),
    });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const enableAllSections = useCallback(() => {
    const schema = schemaRef.current;
    if (!schema || schema.controlType !== "group") return;
    const defaultsBySection: Record<string, ConfigValues> = {};
    for (const child of (schema as GroupNode).children) {
      if (child.controlType !== "group") continue;
      const built = buildDefaults(child);
      if (isPlainObject(built)) defaultsBySection[child.key] = built;
    }
    dispatch({ type: "ENABLE_ALL_SECTIONS", defaultsBySection });
  }, []);

  const loadFromYaml = useCallback(async (yaml: string) => {
    let parsed: unknown;
    try {
      parsed = loadYaml(yaml);
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
        listItemIds: {},
      },
    });
  }, []);

  const validateFieldAction = useCallback((path: string): string | null => {
    const segments = parsePath(path);
    const node = findNodeByPath(schemaRef.current, segments);
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

  const actions = useMemo(
    () => ({
      setValue,
      setValueByPath,
      setOverride,
      setEnabled,
      selectPlugin,
      addListItem,
      removeListItem,
      setMapEntry,
      removeMapEntry,
      resetToDefaults,
      enableAllSections,
      loadFromYaml,
      validateField: validateFieldAction,
      validateAll: validateAllAction,
      clearValidationError,
    }),
    // all callbacks are stable; resetToDefaults reads starter via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return { state, ...actions, actions };
}

export function useConfigurationBuilder() {
  const stateValue = useContext(ConfigStateContext);
  const actionsValue = useContext(ConfigDispatchContext);
  if (!stateValue || !actionsValue) {
    throw new Error("useConfigurationBuilder must be used within ConfigurationBuilderProvider");
  }
  return { ...stateValue, ...actionsValue };
}
