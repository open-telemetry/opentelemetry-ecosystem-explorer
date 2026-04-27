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
import { useMemo, useState, type JSX } from "react";
import { Copy, Download, RefreshCcw, ListPlus } from "lucide-react";
import type { ConfigNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { generateYaml } from "@/lib/yaml-generator";
import { downloadText } from "@/lib/download-text";
import { YamlCodeBlock } from "./yaml-code-block";

interface PreviewCardProps {
  schema: ConfigNode;
}

const COPIED_FLASH_MS = 2000;

export function PreviewCard({ schema }: PreviewCardProps): JSX.Element {
  const { state, enableAllSections, resetToDefaults, validateAll } = useConfigurationBuilder();
  const yaml = useMemo(() => generateYaml(state, schema), [state, schema]);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    validateAll();
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FLASH_MS);
  };

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
      className="rounded-xl border border-border/50 bg-card/40 p-5 space-y-3 lg:sticky lg:top-24"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">Output Preview</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-card px-3 py-1 text-xs text-foreground hover:bg-card/80"
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => {
              validateAll();
              downloadText(`otel-config-${state.version}.yaml`, yaml, "text/yaml");
            }}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-card px-3 py-1 text-xs text-foreground hover:bg-card/80"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            Download
          </button>
          <span className="mx-1 h-4 w-px bg-border/60" aria-hidden="true" />
          <button
            type="button"
            onClick={enableAllSections}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-card px-3 py-1 text-xs text-foreground hover:bg-card/80"
          >
            <ListPlus className="h-3 w-3" aria-hidden="true" />
            Add all
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-card px-3 py-1 text-xs text-foreground hover:bg-card/80"
          >
            <RefreshCcw className="h-3 w-3" aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>
      <YamlCodeBlock
        code={yaml}
        className="overflow-auto max-h-[calc(100vh-8rem)] rounded-md bg-background/60 p-4 text-xs font-mono text-foreground"
      />
    </section>
  );
}
