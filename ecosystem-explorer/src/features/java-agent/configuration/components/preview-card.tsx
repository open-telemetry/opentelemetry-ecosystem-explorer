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
import { useMemo, type JSX } from "react";
import { Download, RefreshCcw, ListPlus } from "lucide-react";
import type { ConfigNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { generateYaml } from "@/lib/yaml-generator";
import { downloadText } from "@/lib/download-text";
import { CopyButton } from "@/components/ui/copy-button";
import { YamlCodeBlock } from "./yaml-code-block";

interface PreviewCardProps {
  schema: ConfigNode;
}

export function PreviewCard({ schema }: PreviewCardProps): JSX.Element {
  const { state, enableAllSections, resetToDefaults, validateAll } = useConfigurationBuilder();
  const yaml = useMemo(() => generateYaml(state, schema), [state, schema]);

  const handleReset = () => {
    if (state.isDirty) {
      const ok = window.confirm("Reset to defaults? This will clear your changes.");
      if (!ok) return;
    }
    resetToDefaults();
  };

  return (
    <section
      aria-label="Output Preview"
      className="border-border/50 bg-card/40 space-y-3 rounded-xl border p-5 lg:sticky lg:top-24"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-foreground text-sm font-medium">Output Preview</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div onClickCapture={validateAll}>
            <CopyButton
              text={yaml}
              className="border-border/60 bg-card text-foreground hover:bg-card/80 inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              validateAll();
              downloadText(`otel-config-${state.version}.yaml`, yaml, "text/yaml");
            }}
            className="border-border/60 bg-card text-foreground hover:bg-card/80 flex items-center gap-1 rounded-md border px-3 py-1 text-xs"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            Download
          </button>
          <span className="bg-border/60 mx-1 h-4 w-px" aria-hidden="true" />
          <button
            type="button"
            onClick={enableAllSections}
            className="border-border/60 bg-card text-foreground hover:bg-card/80 flex items-center gap-1 rounded-md border px-3 py-1 text-xs"
          >
            <ListPlus className="h-3 w-3" aria-hidden="true" />
            Add all
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="border-border/60 bg-card text-foreground hover:bg-card/80 flex items-center gap-1 rounded-md border px-3 py-1 text-xs"
          >
            <RefreshCcw className="h-3 w-3" aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>
      <YamlCodeBlock
        code={yaml}
        className="bg-background/60 text-foreground max-h-[calc(100vh-8rem)] overflow-auto rounded-md p-4 font-mono text-xs"
      />
    </section>
  );
}
