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
import type { ConfigNode, ConfigStarter } from "@/types/configuration";
import {
  useConfigurationBuilderState,
  ConfigStateContext,
  ConfigDispatchContext,
} from "./use-configuration-builder";
import { StarterPathsContext } from "@/features/java-agent/configuration/components/configuration-ui-context";
import { collectStarterPaths } from "@/lib/collect-starter-paths";

interface ConfigurationBuilderProviderProps {
  schema: ConfigNode;
  version: string;
  starter: ConfigStarter | null;
  children: ReactNode;
}

export function ConfigurationBuilderProvider({
  schema,
  version,
  starter,
  children,
}: ConfigurationBuilderProviderProps) {
  const { state, actions } = useConfigurationBuilderState(schema, version, starter);
  const stateValue = useMemo(() => ({ state }), [state]);
  const starterPaths = useMemo(
    () =>
      starter?.values
        ? collectStarterPaths(starter.values as Record<string, unknown>)
        : new Set<string>(),
    [starter]
  );

  return (
    <ConfigStateContext.Provider value={stateValue}>
      <ConfigDispatchContext.Provider value={actions}>
        <StarterPathsContext.Provider value={starterPaths}>{children}</StarterPathsContext.Provider>
      </ConfigDispatchContext.Provider>
    </ConfigStateContext.Provider>
  );
}
