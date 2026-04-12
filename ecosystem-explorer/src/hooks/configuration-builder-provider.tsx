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
import { useMemo, type ReactNode } from "react";
import type { ConfigNode } from "@/types/configuration";
import {
  useConfigurationBuilderState,
  ConfigStateContext,
  ConfigDispatchContext,
} from "./use-configuration-builder";

interface ConfigurationBuilderProviderProps {
  schema: ConfigNode;
  version: string;
  children: ReactNode;
}

export function ConfigurationBuilderProvider({
  schema,
  version,
  children,
}: ConfigurationBuilderProviderProps) {
  const { state, ...actions } = useConfigurationBuilderState(schema, version);

  const stateValue = useMemo(() => ({ state }), [state]);
  const actionsValue = useMemo(
    () => actions,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <ConfigStateContext.Provider value={stateValue}>
      <ConfigDispatchContext.Provider value={actionsValue}>
        {children}
      </ConfigDispatchContext.Provider>
    </ConfigStateContext.Provider>
  );
}
