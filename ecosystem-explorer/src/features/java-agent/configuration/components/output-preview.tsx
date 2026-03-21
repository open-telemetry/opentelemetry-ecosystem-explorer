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
import { useMemo } from "react";
import { useConfigurationBuilder } from "../hooks/use-configuration-builder";
import { generateYamlFile } from "../utils/yaml-generator";
import { ExportToolbar } from "./export-toolbar";

export function OutputPreview() {
  const { state } = useConfigurationBuilder();

  const output = useMemo(() => {
    return generateYamlFile(state);
  }, [state]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end gap-2 mb-4">
        <ExportToolbar />
      </div>
      <div className="flex-1 overflow-auto">
        <pre className="text-xs font-mono bg-muted/30 p-4 rounded border border-border whitespace-pre-wrap break-words">
          {output}
        </pre>
      </div>
    </div>
  );
}
