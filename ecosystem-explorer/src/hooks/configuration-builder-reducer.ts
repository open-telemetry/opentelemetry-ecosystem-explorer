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

export const INITIAL_STATE: ConfigurationBuilderState = {
  version: "",
  values: {},
  enabledSections: {},
  validationErrors: {},
  isDirty: false,
};

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
        values: setByPath(state.values, action.path, action.value),
        validationErrors: remainingErrors,
        isDirty: true,
      };
    }

    case "SET_ENABLED": {
      const hasExistingValues = state.values[action.section] !== undefined;
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
      return {
        ...state,
        values: setByPath(state.values, action.path, arr as ConfigValue),
        isDirty: true,
      };
    }

    case "REMOVE_LIST_ITEM": {
      const list = getByPath(state.values, action.path);
      if (!Array.isArray(list)) return state;
      const newList = [...list];
      newList.splice(action.index, 1);
      return {
        ...state,
        values: setByPath(state.values, action.path, newList as ConfigValue),
        isDirty: true,
      };
    }

    case "SET_MAP_ENTRY": {
      const map = getByPath(state.values, action.path);
      const currentMap =
        typeof map === "object" && map !== null && !Array.isArray(map) ? (map as ConfigValues) : {};
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

    case "RESET_TO_DEFAULTS":
      return { ...INITIAL_STATE, version: state.version };

    case "LOAD_STATE":
      return action.state;

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

    default:
      return state;
  }
}
