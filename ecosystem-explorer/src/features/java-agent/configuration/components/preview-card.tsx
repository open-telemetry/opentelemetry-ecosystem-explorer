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
import { Download, RefreshCcw, ListPlus, Maximize2 } from "lucide-react";
import type { ConfigNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { generateYamlSections, structuredToString } from "@/lib/yaml-generator";
import { downloadText } from "@/lib/download-text";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { YamlCodeBlock } from "./yaml-code-block";

interface HeaderActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
}

function HeaderActionButton({
  icon: Icon,
  label,
  className = "",
  ...props
}: HeaderActionButtonProps) {
  return (
    <button
      {...props}
      type="button"
      className={`border-border/60 bg-card text-foreground hover:bg-card/80 focus-visible:ring-primary inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </button>
  );
}

interface PreviewActionsProps {
  yaml: string;
  filename: string;
  onValidate: () => void;
}

function PreviewActions({ yaml, filename, onValidate }: PreviewActionsProps) {
  return (
    <>
      <CopyButton
        text={yaml}
        onClick={onValidate}
        className="border-border/60 bg-card text-foreground hover:bg-card/80 focus-visible:ring-primary inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      />
      <HeaderActionButton
        icon={Download}
        label="Download"
        onClick={() => {
          onValidate();
          downloadText(filename, yaml, "text/yaml");
        }}
      />
    </>
  );
}

interface PreviewCardProps {
  schema: ConfigNode;
  javaAgentVersion: string;
  activePreviewKey: string | null;
  activeTab: string;
}

export function PreviewCard({
  schema,
  javaAgentVersion,
  activePreviewKey,
  activeTab,
}: PreviewCardProps): JSX.Element {
  const { state, enableAllSections, resetToDefaults, validateAll } = useConfigurationBuilder();

  const structured = useMemo(
    () => generateYamlSections(state, schema, { javaAgentVersion: javaAgentVersion || undefined }),
    [state, schema, javaAgentVersion]
  );

  const yaml = useMemo(() => structuredToString(structured), [structured]);

  const activeKey = activeTab === "sdk" && activePreviewKey === "general" ? null : activePreviewKey;

  const handleReset = () => {
    if (state.isDirty) {
      const ok = window.confirm("Reset to defaults? This will clear your changes.");
      if (!ok) return;
    }
    resetToDefaults();
  };

  const filename = `otel-config-${state.version}.yaml`;

  return (
    <section
      aria-label="Output Preview"
      className="border-border/50 bg-card/40 space-y-3 rounded-xl border p-5 lg:sticky lg:top-20 lg:self-start"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-foreground text-sm font-medium">Output Preview</h3>
        <div className="flex flex-wrap items-center gap-2">
          <PreviewActions yaml={yaml} filename={filename} onValidate={validateAll} />
          <span className="bg-border/60 mx-1 h-4 w-px" aria-hidden="true" />
          <HeaderActionButton icon={ListPlus} label="Add all" onClick={enableAllSections} />
          <HeaderActionButton icon={RefreshCcw} label="Reset" onClick={handleReset} />
          <span className="bg-border/60 mx-1 h-4 w-px" aria-hidden="true" />
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Expand YAML preview"
                className="border-border/60 bg-card text-foreground hover:bg-card/80 focus-visible:ring-primary flex cursor-pointer items-center justify-center rounded-md border p-1.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[85dvh] w-[90vw] max-w-4xl flex-col gap-4">
              <header className="border-border/30 flex flex-wrap items-center justify-between gap-4 border-b pr-8 pb-3">
                <div className="space-y-1">
                  <DialogTitle className="text-xl font-semibold">
                    YAML Configuration Preview
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs">
                    Complete generated YAML configuration for your OpenTelemetry Java Agent.
                  </DialogDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PreviewActions yaml={yaml} filename={filename} onValidate={validateAll} />
                </div>
              </header>
              <div className="bg-background/60 border-border/30 min-h-0 flex-1 overflow-auto rounded-md border p-4">
                <YamlCodeBlock code={yaml} className="text-foreground font-mono text-xs" />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <YamlCodeBlock
        structured={structured}
        activePreviewKey={activeKey}
        className="bg-background/60 text-foreground max-h-[calc(100vh-8rem)] overflow-auto rounded-md p-4 font-mono text-xs"
      />
    </section>
  );
}
