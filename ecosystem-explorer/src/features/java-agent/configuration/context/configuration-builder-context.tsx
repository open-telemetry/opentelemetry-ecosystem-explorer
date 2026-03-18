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
import { useReducer, type ReactNode } from "react";
import type { ConfigurationBuilderState, ConfigurationBuilderAction } from "@/types/javaagent";
import { ConfigurationBuilderContext } from "./configuration-builder-context";

const initialState: ConfigurationBuilderState = {
  version: "",
  activeArea: "instrumentation",
  selectedInstrumentations: new Map(),
  configOverrides: new Map(),
  outputFormat: "properties",
  isInitialized: false,
};

function configurationBuilderReducer(
  state: ConfigurationBuilderState,
  action: ConfigurationBuilderAction
): ConfigurationBuilderState {
  switch (action.type) {
    case "SET_VERSION":
      return {
        ...state,
        version: action.version,
      };

    case "SET_ACTIVE_AREA":
      return {
        ...state,
        activeArea: action.area,
      };

    case "ADD_INSTRUMENTATION": {
      const newInstrumentations = new Map(state.selectedInstrumentations);
      const enabledConfigs = new Set<string>();

      action.data.configurations?.forEach((config) => {
        enabledConfigs.add(config.name);
      });

      newInstrumentations.set(action.name, {
        name: action.name,
        data: action.data,
        enabledConfigs,
      });

      return {
        ...state,
        selectedInstrumentations: newInstrumentations,
      };
    }

    case "REMOVE_INSTRUMENTATION": {
      const newInstrumentations = new Map(state.selectedInstrumentations);
      newInstrumentations.delete(action.name);

      return {
        ...state,
        selectedInstrumentations: newInstrumentations,
      };
    }

    case "UPDATE_CONFIG": {
      const newConfigOverrides = new Map(state.configOverrides);
      const existingConfig = state.configOverrides.get(action.configName);

      newConfigOverrides.set(action.configName, {
        name: action.configName,
        value: action.value,
        isModified: true,
        default: existingConfig?.default ?? action.value,
      });

      return {
        ...state,
        configOverrides: newConfigOverrides,
      };
    }

    case "TOGGLE_CONFIG": {
      const newInstrumentations = new Map(state.selectedInstrumentations);
      const instrumentation = newInstrumentations.get(action.instrumentationName);

      if (instrumentation) {
        const newEnabledConfigs = new Set(instrumentation.enabledConfigs);
        if (newEnabledConfigs.has(action.configName)) {
          newEnabledConfigs.delete(action.configName);
        } else {
          newEnabledConfigs.add(action.configName);
        }

        newInstrumentations.set(action.instrumentationName, {
          ...instrumentation,
          enabledConfigs: newEnabledConfigs,
        });
      }

      return {
        ...state,
        selectedInstrumentations: newInstrumentations,
      };
    }

    case "SET_OUTPUT_FORMAT":
      return {
        ...state,
        outputFormat: action.format,
      };

    case "LOAD_STATE": {
      return {
        ...state,
        ...action.state,
      };
    }

    case "RESET":
      return {
        ...initialState,
        version: state.version,
      };

    case "MARK_INITIALIZED":
      return {
        ...state,
        isInitialized: true,
      };

    default:
      return state;
  }
}

interface ConfigurationBuilderProviderProps {
  children: ReactNode;
}

export function ConfigurationBuilderProvider({ children }: ConfigurationBuilderProviderProps) {
  const [state, dispatch] = useReducer(configurationBuilderReducer, initialState);

  return (
    <ConfigurationBuilderContext.Provider value={{ state, dispatch }}>
      {children}
    </ConfigurationBuilderContext.Provider>
  );
}
