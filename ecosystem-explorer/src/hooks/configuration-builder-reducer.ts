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
import type {
  ConfigurationBuilderState,
  ConfigurationBuilderAction,
  ConfigValues,
  ConfigValue,
} from "@/types/configuration-builder";
import { getByPath, setByPath, serializePath } from "@/lib/config-path";
import { hasUserValues } from "@/lib/state-hydrate";
import { isPlainObject } from "@/lib/value-guards";
import { buildListItemIds, generateListItemId } from "@/lib/build-list-item-ids";

export const INITIAL_STATE: ConfigurationBuilderState = {
  version: "",
  values: {},
  enabledSections: {},
  validationErrors: {},
  isDirty: false,
  listItemIds: {},
};

const INSTRUMENTATION_PATH = ["distribution", "javaagent", "instrumentation"];

function cleanInstrumentation(values: ConfigValues): ConfigValues {
  if (!values.distribution || typeof values.distribution !== "object") return values;
  const dist = { ...values.distribution } as ConfigValues;
  if (!dist.javaagent || typeof dist.javaagent !== "object") return values;
  const ja = { ...dist.javaagent } as ConfigValues;
  if (!ja.instrumentation || typeof ja.instrumentation !== "object") return values;

  const inst = { ...ja.instrumentation } as ConfigValues;
  let changed = false;

  for (const [moduleName, moduleVal] of Object.entries(inst)) {
    if (moduleVal && typeof moduleVal === "object" && !Array.isArray(moduleVal)) {
      const modObj = { ...moduleVal } as ConfigValues;
      if (modObj.enabled === null || modObj.enabled === undefined) {
        delete modObj.enabled;
        changed = true;
      }
      if (Object.keys(modObj).length === 0) {
        delete inst[moduleName];
        changed = true;
      } else {
        inst[moduleName] = modObj;
      }
    } else if (moduleVal === null || moduleVal === undefined) {
      delete inst[moduleName];
      changed = true;
    }
  }

  if (!changed && Object.keys(inst).length > 0) return values;

  if (Object.keys(inst).length === 0) {
    delete ja.instrumentation;
  } else {
    ja.instrumentation = inst;
  }

  if (Object.keys(ja).length === 0) {
    delete dist.javaagent;
  } else {
    dist.javaagent = ja;
  }

  if (Object.keys(dist).length === 0) {
    const copy = { ...values };
    delete copy.distribution;
    return copy;
  } else {
    return { ...values, distribution: dist };
  }
}

export function configurationBuilderReducer(
  state: ConfigurationBuilderState,
  action: ConfigurationBuilderAction
): ConfigurationBuilderState {
  switch (action.type) {
    case "SET_VALUE": {
      const pathKey = serializePath(action.path);
      const remainingErrors = { ...state.validationErrors };
      delete remainingErrors[pathKey];
      return {
        ...state,
        values: cleanInstrumentation(setByPath(state.values, action.path, action.value)),
        validationErrors: remainingErrors,
        isDirty: true,
      };
    }

    case "SET_ENABLED": {
      const hasExistingValues = hasUserValues(state.values[action.section]);
      const newValues =
        action.enabled && !hasExistingValues && action.defaults
          ? { ...state.values, [action.section]: action.defaults }
          : state.values;
      return {
        ...state,
        values: newValues,
        enabledSections: { ...state.enabledSections, [action.section]: action.enabled },
        isDirty: true,
      };
    }

    case "SELECT_PLUGIN":
      return {
        ...state,
        values: setByPath(state.values, action.path, action.defaults),
        isDirty: true,
      };

    case "ADD_LIST_ITEM": {
      const currentList = getByPath(state.values, action.path);
      const arr = Array.isArray(currentList) ? [...currentList] : [];
      arr.push(action.defaultItem);
      const pathKey = serializePath(action.path);
      const currentIds = state.listItemIds ?? {};
      const existingIds = currentIds[pathKey] ?? [];
      return {
        ...state,
        values: setByPath(state.values, action.path, arr as ConfigValue),
        listItemIds: {
          ...currentIds,
          [pathKey]: [...existingIds, generateListItemId()],
        },
        isDirty: true,
      };
    }

    case "REMOVE_LIST_ITEM": {
      const list = getByPath(state.values, action.path);
      if (!Array.isArray(list)) return state;
      const newList = [...list];
      newList.splice(action.index, 1);
      const pathKey = serializePath(action.path);
      const currentIds = state.listItemIds ?? {};
      const existingIds = currentIds[pathKey];
      const nextIds = existingIds ? existingIds.filter((_, i) => i !== action.index) : existingIds;
      return {
        ...state,
        values: setByPath(state.values, action.path, newList as ConfigValue),
        listItemIds: nextIds ? { ...currentIds, [pathKey]: nextIds } : currentIds,
        isDirty: true,
      };
    }

    case "SET_MAP_ENTRY": {
      const map = getByPath(state.values, action.path);
      const currentMap: ConfigValues = isPlainObject(map) ? map : {};
      return {
        ...state,
        values: setByPath(state.values, action.path, {
          ...currentMap,
          [action.key]: action.value,
        }),
        isDirty: true,
      };
    }

    case "REMOVE_MAP_ENTRY": {
      const mapVal = getByPath(state.values, action.path);
      if (typeof mapVal !== "object" || mapVal === null || Array.isArray(mapVal)) return state;
      const rest = { ...(mapVal as ConfigValues) };
      delete rest[action.key];
      return {
        ...state,
        values: setByPath(state.values, action.path, rest),
        isDirty: true,
      };
    }

    case "LOAD_STATE": {
      const next = action.state;
      // Re-seed ids whenever the values tree is replaced wholesale so React
      // keys reflect the new items rather than a stale add/remove history.
      return { ...next, listItemIds: buildListItemIds(next.values) };
    }

    case "SET_VALIDATION_ERRORS":
      return { ...state, validationErrors: action.errors };

    case "SET_FIELD_ERROR": {
      if (action.error === null) {
        const rest = { ...state.validationErrors };
        delete rest[action.path];
        return { ...state, validationErrors: rest };
      }
      return {
        ...state,
        validationErrors: { ...state.validationErrors, [action.path]: action.error },
      };
    }

    case "ENABLE_ALL_SECTIONS": {
      const newEnabled: Record<string, boolean> = { ...state.enabledSections };
      const newValues: ConfigValues = { ...state.values };
      let changed = false;
      for (const [key, defaults] of Object.entries(action.defaultsBySection)) {
        if (newEnabled[key] !== true) {
          newEnabled[key] = true;
          changed = true;
        }
        if (!hasUserValues(newValues[key])) {
          newValues[key] = defaults;
          changed = true;
        }
      }
      if (!changed) return state;
      return { ...state, values: newValues, enabledSections: newEnabled, isDirty: true };
    }

    case "PRUNE_INSTRUMENTATIONS": {
      const current = getByPath(state.values, INSTRUMENTATION_PATH);
      if (!isPlainObject(current)) return state;

      const valid = new Set(action.validModules);
      let changed = false;
      const nextInst: ConfigValues = { ...current };

      for (const key of Object.keys(nextInst)) {
        if (!valid.has(key)) {
          delete nextInst[key];
          changed = true;
        }
      }

      if (!changed) return state;

      return {
        ...state,
        values: cleanInstrumentation(setByPath(state.values, INSTRUMENTATION_PATH, nextInst)),
      };
    }

    default:
      return state;
  }
}
