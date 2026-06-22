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
import { useTranslation } from "react-i18next";
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
      className={`border-border/60 bg-card text-foreground hover:bg-muted/50 focus-visible:ring-primary inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
  hasErrors: boolean;
}

function PreviewActions({ yaml, filename, onValidate, hasErrors }: PreviewActionsProps) {
  const { t } = useTranslation("java-agent");
  return (
    <>
      <CopyButton
        text={yaml}
        onClick={onValidate}
        className="border-border/60 bg-card text-foreground hover:bg-muted/50 focus-visible:ring-primary inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      />
      <HeaderActionButton
        icon={Download}
        label={t("builder.preview.download")}
        disabled={hasErrors}
        title={hasErrors ? t("builder.preview.downloadErrorTitle") : undefined}
        onClick={() => {
          onValidate();
          if (!hasErrors) downloadText(filename, yaml, "text/yaml");
        }}
      />
    </>
  );
}

interface PreviewCardProps {
  schema: ConfigNode;
  javaAgentVersion: string;
  activePreviewKey: string | null;
}

export function PreviewCard({
  schema,
  javaAgentVersion,
  activePreviewKey,
}: PreviewCardProps): JSX.Element {
  const { t } = useTranslation("java-agent");
  const { state, enableAllSections, resetToDefaults, validateAll } = useConfigurationBuilder();
  const hasErrors = Object.keys(state.validationErrors).length > 0;
  const structured = useMemo(
    () => generateYamlSections(state, schema, { javaAgentVersion: javaAgentVersion || undefined }),
    [state, schema, javaAgentVersion]
  );

  const yaml = useMemo(() => structuredToString(structured), [structured]);

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
      aria-label={t("builder.preview.title")}
      className="border-border/50 bg-surface-card shadow-surface space-y-3 rounded-xl border p-5 lg:sticky lg:top-20 lg:self-start"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-foreground text-sm font-medium">{t("builder.preview.title")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <PreviewActions
            yaml={yaml}
            filename={filename}
            onValidate={validateAll}
            hasErrors={hasErrors}
          />
          <span className="bg-border/60 mx-1 h-4 w-px" aria-hidden="true" />
          <HeaderActionButton
            icon={ListPlus}
            label={t("builder.preview.addAll")}
            onClick={enableAllSections}
          />
          <HeaderActionButton
            icon={RefreshCcw}
            label={t("builder.preview.reset")}
            onClick={handleReset}
          />
          <span className="bg-border/60 mx-1 h-4 w-px" aria-hidden="true" />
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={t("builder.preview.expandAriaLabel")}
                className="border-border/60 bg-card text-foreground hover:bg-muted/50 focus-visible:ring-primary flex cursor-pointer items-center justify-center rounded-md border p-1.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[85dvh] w-[90vw] max-w-4xl flex-col gap-4">
              <header className="border-border/30 flex flex-wrap items-center justify-between gap-4 border-b pr-8 pb-3">
                <div className="space-y-1">
                  <DialogTitle className="text-xl font-semibold">
                    {t("builder.preview.dialogTitle")}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs">
                    {t("builder.preview.dialogDescription")}
                  </DialogDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PreviewActions
                    yaml={yaml}
                    filename={filename}
                    onValidate={validateAll}
                    hasErrors={hasErrors}
                  />
                </div>
              </header>
              <div className="bg-code-bg border-border/30 min-h-0 flex-1 overflow-auto rounded-md border p-4">
                <YamlCodeBlock code={yaml} className="text-code-fg font-mono text-xs" />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <YamlCodeBlock
        structured={structured}
        activePreviewKey={activePreviewKey}
        className="bg-code-bg text-code-fg max-h-[calc(100vh-8rem)] overflow-auto rounded-md p-4 font-mono text-xs"
      />
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {activePreviewKey ? `Highlighting ${activePreviewKey} section` : ""}
      </div>
    </section>
  );
}
